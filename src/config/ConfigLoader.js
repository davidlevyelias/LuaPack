const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const SCHEMA_V1_PATH = path.resolve(
	__dirname,
	'..',
	'..',
	'config.schema.json'
);
const SCHEMA_V2_PATH = path.resolve(
	__dirname,
	'..',
	'..',
	'config.v2.schema.json'
);

const validators = {
	v1: null,
	v2: null,
};

const MISSING_POLICIES = new Set(['error', 'warn', 'ignore']);
const BUNDLE_MODES = new Set(['runtime', 'typed']);
const FALLBACK_MODES = new Set(['never', 'external-only', 'always']);
const RULE_MODES = new Set(['bundle', 'external', 'ignore']);

const OBSOLETE_OBFUSCATION_WARNING =
	'Internal obfuscation was removed in LuaPack v2. Obfuscation settings are ignored; use an external post-processing tool after packing.';

function buildDefaultOutputPath(entryPath) {
	const entryDir = path.dirname(entryPath);
	const entryExt = path.extname(entryPath);
	const entryBase = path.basename(entryPath, entryExt) || path.basename(entryPath);
	const outputName = `${entryBase}_packed.lua`;
	return path.join(entryDir, outputName);
}

function hasOwn(target, key) {
	return Object.prototype.hasOwnProperty.call(target, key);
}

function createValidator(schemaPath) {
	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
	const ajv = new Ajv({
		allErrors: true,
		useDefaults: true,
		strict: false,
	});
	return ajv.compile(schema);
}

function getValidator(version) {
	if (version !== 'v1' && version !== 'v2') {
		throw new Error(`Unsupported configuration version '${version}'.`);
	}

	if (!validators[version]) {
		validators[version] = createValidator(
			version === 'v2' ? SCHEMA_V2_PATH : SCHEMA_V1_PATH
		);
	}

	return validators[version];
}

function formatErrors(errors) {
	return errors
		.map((err) => {
			const dataPath = err.instancePath || err.dataPath || '';
			const location = dataPath
				? `property '${dataPath.replace(/^\./, '')}'`
				: 'configuration root';
			return `- ${location}: ${err.message}`;
		})
		.join('\n');
}

function readConfigFile(configPath) {
	const resolvedPath = path.resolve(configPath);
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Config file not found at ${resolvedPath}`);
	}

	let parsed;
	try {
		const raw = fs.readFileSync(resolvedPath, 'utf-8');
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(
			`Failed to read config file '${resolvedPath}': ${error.message}`
		);
	}

	return { config: parsed, baseDir: path.dirname(resolvedPath) };
}

function detectConfigVersion(config) {
	if (
		config &&
		typeof config === 'object' &&
		Number(config.schemaVersion) === 2
	) {
		return 'v2';
	}
	return 'v1';
}

function hasObfuscationCliToggles(cliOptions) {
	return ['renameVariables', 'minify', 'ascii'].some(
		(key) => typeof cliOptions[key] === 'boolean'
	);
}

function emitWarning(message, cliOptions) {
	if (typeof cliOptions.onWarning === 'function') {
		cliOptions.onWarning(message);
		return;
	}
	console.warn(message);
}

function mergeConfig(baseConfig, cliOptions, configVersion) {
	const merged = { ...baseConfig };

	if (cliOptions.entry) {
		merged.entry = cliOptions.entry;
	}

	if (cliOptions.output) {
		merged.output = cliOptions.output;
	}

	if (configVersion === 'v2') {
		if (cliOptions.sourceroot) {
			const cliRoot = path.resolve(process.cwd(), cliOptions.sourceroot);
			const existingRoots = Array.isArray(merged.modules?.roots)
				? merged.modules.roots
				: [];
			merged.modules = {
				...(merged.modules || {}),
				roots: [
					cliRoot,
					...existingRoots.filter((value) => value !== cliRoot),
				],
			};
		}

		if (typeof cliOptions.ignoreMissing === 'boolean') {
			merged.modules = {
				...(merged.modules || {}),
				missing: cliOptions.ignoreMissing ? 'warn' : 'error',
			};
		}

		if (cliOptions.env !== undefined) {
			const envValues = Array.isArray(cliOptions.env) ? cliOptions.env : [];
			merged.modules = {
				...(merged.modules || {}),
				env: envValues,
			};
		}

		return merged;
	}

	if (cliOptions.sourceroot) {
		merged.sourceRoot = cliOptions.sourceroot;
	}

	if (typeof cliOptions.ignoreMissing === 'boolean') {
		merged.modules = {
			...(merged.modules || {}),
			ignoreMissing: cliOptions.ignoreMissing,
		};
	}

	if (cliOptions.env !== undefined) {
		const envValues = Array.isArray(cliOptions.env) ? cliOptions.env : [];
		merged.modules = {
			...(merged.modules || {}),
			external: {
				...((merged.modules && merged.modules.external) || {}),
				env: envValues,
			},
		};
	}

	return merged;
}

function normalizePathsV1(config, cliOptions, fileBaseDir) {
	const finalConfig = { ...config };
	const cwd = process.cwd();
	const baseDir = fileBaseDir || cwd;

	if (finalConfig.entry) {
		const origin = cliOptions.entry ? cwd : baseDir;
		finalConfig.entry = path.resolve(origin, finalConfig.entry);
	}

	if (finalConfig.output) {
		const origin = cliOptions.output ? cwd : baseDir;
		finalConfig.output = path.resolve(origin, finalConfig.output);
	}

	if (!finalConfig.output && finalConfig.entry) {
		finalConfig.output = buildDefaultOutputPath(finalConfig.entry);
	}

	if (finalConfig.sourceRoot) {
		const origin = cliOptions.sourceroot ? cwd : baseDir;
		finalConfig.sourceRoot = path.resolve(origin, finalConfig.sourceRoot);
	}

	if (
		finalConfig.modules &&
		finalConfig.modules.external &&
		Array.isArray(finalConfig.modules.external.paths)
	) {
		const origin = baseDir;
		finalConfig.modules.external.paths =
			finalConfig.modules.external.paths.map((p) =>
				path.isAbsolute(p) ? p : path.resolve(origin, p)
			);
	}

	return finalConfig;
}

function normalizePathsV2(config, cliOptions, fileBaseDir) {
	const finalConfig = { ...config };
	const cwd = process.cwd();
	const baseDir = fileBaseDir || cwd;

	if (finalConfig.entry) {
		const origin = cliOptions.entry ? cwd : baseDir;
		finalConfig.entry = path.resolve(origin, finalConfig.entry);
	}

	if (finalConfig.output) {
		const origin = cliOptions.output ? cwd : baseDir;
		finalConfig.output = path.resolve(origin, finalConfig.output);
	}

	if (!finalConfig.output && finalConfig.entry) {
		finalConfig.output = buildDefaultOutputPath(finalConfig.entry);
	}

	const modules = finalConfig.modules || {};
	if (Array.isArray(modules.roots)) {
		modules.roots = modules.roots.map((rootPath) =>
			path.isAbsolute(rootPath)
				? rootPath
				: path.resolve(baseDir, rootPath)
		);
	}

	if (modules.rules && typeof modules.rules === 'object') {
		for (const [moduleId, rule] of Object.entries(modules.rules)) {
			if (!rule || typeof rule !== 'object') {
				continue;
			}
			if (typeof rule.path === 'string') {
				modules.rules[moduleId] = {
					...rule,
					path: path.isAbsolute(rule.path)
						? rule.path
						: path.resolve(baseDir, rule.path),
				};
			}
		}
	}

	finalConfig.modules = modules;
	return finalConfig;
}

function normalizeRuleMode(mode) {
	if (typeof mode === 'string' && RULE_MODES.has(mode)) {
		return mode;
	}
	return 'bundle';
}

function normalizeModuleRules(rules) {
	if (!rules || typeof rules !== 'object') {
		return {};
	}

	const normalized = {};
	for (const [moduleId, rule] of Object.entries(rules)) {
		if (!rule || typeof rule !== 'object') {
			continue;
		}

		const entry = {
			mode: normalizeRuleMode(rule.mode),
		};
		if (typeof rule.path === 'string' && rule.path.length > 0) {
			entry.path = rule.path;
		}
		if (typeof rule.recursive === 'boolean') {
			entry.recursive = rule.recursive;
		}
		normalized[moduleId] = entry;
	}

	return normalized;
}

function uniquePaths(paths) {
	const output = [];
	const seen = new Set();
	for (const value of paths) {
		if (typeof value !== 'string' || value.length === 0) {
			continue;
		}
		if (seen.has(value)) {
			continue;
		}
		seen.add(value);
		output.push(value);
	}
	return output;
}

function normalizeToV2Config(config, version) {
	if (version === 'v2') {
		const modules = config.modules || {};
		const roots = uniquePaths(
			Array.isArray(modules.roots) && modules.roots.length > 0
				? modules.roots
				: [path.dirname(config.entry)]
		);
		const env = Array.isArray(modules.env)
			? modules.env.filter((value) => typeof value === 'string' && value.length > 0)
			: [];
		const missing =
			typeof modules.missing === 'string' && MISSING_POLICIES.has(modules.missing)
				? modules.missing
				: 'error';
		const bundle = config.bundle || {};
		const bundleMode =
			typeof bundle.mode === 'string' && BUNDLE_MODES.has(bundle.mode)
				? bundle.mode
				: 'runtime';
		const fallback =
			typeof bundle.fallback === 'string' && FALLBACK_MODES.has(bundle.fallback)
				? bundle.fallback
				: 'external-only';

		return {
			schemaVersion: 2,
			entry: config.entry,
			output: config.output,
			modules: {
				roots,
				env,
				missing,
				rules: normalizeModuleRules(modules.rules),
			},
			bundle: {
				mode: bundleMode,
				fallback,
			},
			_compat: {
				externalRecursive: true,
			},
		};
	}

	const modulesConfig = config.modules || {};
	const externalConfig = modulesConfig.external || {};
	const sourceRoot = config.sourceRoot || path.dirname(config.entry);
	const externalPaths = Array.isArray(externalConfig.paths)
		? externalConfig.paths
		: [];
	const env = Array.isArray(externalConfig.env)
		? externalConfig.env
		: ['LUA_PATH'];
	const rules = {};

	const ignored = Array.isArray(modulesConfig.ignore) ? modulesConfig.ignore : [];
	for (const moduleId of ignored) {
		rules[moduleId] = { mode: 'ignore' };
	}

	const overrides =
		modulesConfig.overrides && typeof modulesConfig.overrides === 'object'
			? modulesConfig.overrides
			: {};
	for (const [moduleId, override] of Object.entries(overrides)) {
		if (rules[moduleId] && rules[moduleId].mode === 'ignore') {
			continue;
		}
		if (!override || typeof override !== 'object') {
			continue;
		}

		const entry = {
			mode: 'bundle',
		};
		if (typeof override.path === 'string' && override.path.length > 0) {
			entry.path = path.isAbsolute(override.path)
				? override.path
				: path.resolve(sourceRoot, override.path);
		}
		if (typeof override.recursive === 'boolean') {
			entry.recursive = override.recursive;
		}
		rules[moduleId] = entry;
	}

	return {
		schemaVersion: 2,
		entry: config.entry,
		output: config.output,
		modules: {
			roots: uniquePaths([sourceRoot, ...externalPaths]),
			env: env.filter((value) => typeof value === 'string' && value.length > 0),
			missing: modulesConfig.ignoreMissing ? 'warn' : 'error',
			rules,
		},
		bundle: {
			mode: 'runtime',
			fallback: 'external-only',
		},
		_compat: {
			externalRecursive:
				typeof externalConfig.recursive === 'boolean'
					? externalConfig.recursive
					: true,
		},
	};
}

function buildLegacyFacade(v2Config) {
	const roots = Array.isArray(v2Config.modules?.roots)
		? v2Config.modules.roots
		: [path.dirname(v2Config.entry)];
	const sourceRoot = roots[0] || path.dirname(v2Config.entry);
	const externalPaths = roots.slice(1);
	const env = Array.isArray(v2Config.modules?.env)
		? [...v2Config.modules.env]
		: [];
	const rules = v2Config.modules?.rules || {};

	const ignore = [];
	const overrides = {};

	for (const [moduleId, rule] of Object.entries(rules)) {
		if (!rule || typeof rule !== 'object') {
			continue;
		}

		if (rule.mode === 'ignore') {
			ignore.push(moduleId);
			continue;
		}

		if (typeof rule.path === 'string' || typeof rule.recursive === 'boolean') {
			overrides[moduleId] = {};
			if (typeof rule.path === 'string') {
				overrides[moduleId].path = rule.path;
			}
			if (typeof rule.recursive === 'boolean') {
				overrides[moduleId].recursive = rule.recursive;
			}
		}
	}

	const facade = {
		schemaVersion: 2,
		entry: v2Config.entry,
		output: v2Config.output,
		_analyzeOnly: false,
		sourceRoot,
		modules: {
			ignoreMissing: v2Config.modules.missing !== 'error',
			ignore,
			external: {
				enabled: externalPaths.length > 0 || env.length > 0,
				recursive:
					typeof v2Config._compat?.externalRecursive === 'boolean'
						? v2Config._compat.externalRecursive
						: true,
				paths: externalPaths,
				env,
			},
			overrides,
		},
		bundle: { ...v2Config.bundle },
		_v2: v2Config,
	};

	return facade;
}

function loadConfig(cliOptions = {}) {
	let fileConfig = {};
	let baseDir;
	let configVersion = 'v1';

	if (cliOptions.config) {
		const result = readConfigFile(cliOptions.config);
		fileConfig = result.config;
		baseDir = result.baseDir;
		configVersion = detectConfigVersion(fileConfig);
	}

	const merged = mergeConfig(fileConfig, cliOptions, configVersion);
	const hasLegacyObfuscation =
		configVersion === 'v1' && hasOwn(merged, 'obfuscation');
	const hasObfuscationToggles = hasObfuscationCliToggles(cliOptions);

	const validatorInstance = getValidator(configVersion);

	const configCopy = JSON.parse(JSON.stringify(merged));
	const valid = validatorInstance(configCopy);
	if (!valid) {
		const details = formatErrors(validatorInstance.errors || []);
		throw new Error(`Invalid configuration:\n${details}`);
	}

	if (!configCopy.entry) {
		throw new Error('Configuration must specify an entry file.');
	}

	const pathNormalized =
		configVersion === 'v2'
			? normalizePathsV2(configCopy, cliOptions, baseDir)
			: normalizePathsV1(configCopy, cliOptions, baseDir);

	const normalizedV2 = normalizeToV2Config(pathNormalized, configVersion);
	const outputConfig = buildLegacyFacade(normalizedV2);

	const warnings = [];
	if (hasLegacyObfuscation) {
		warnings.push(OBSOLETE_OBFUSCATION_WARNING);
	}
	if (hasObfuscationToggles) {
		warnings.push(OBSOLETE_OBFUSCATION_WARNING);
	}

	outputConfig._warnings = Array.from(new Set(warnings));
	outputConfig._configVersion = configVersion;

	for (const warning of outputConfig._warnings) {
		emitWarning(warning, cliOptions);
	}

	return outputConfig;
}

module.exports = {
	loadConfig,
};
