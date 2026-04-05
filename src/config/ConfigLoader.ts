import {
	LOADER_INTERNALS,
	readConfigFile,
	detectConfigVersion,
	getValidator,
	hasObfuscationCliToggles,
	mergeConfig,
	normalizePaths,
	normalizeToV2Config,
	collectWarnings,
	emitWarning,
	getConfigWarnings,
	setConfigVersion,
	setConfigWarnings,
	validateConfig,
} from './loader';
import type { CliOptions, LoadedConfig } from './loader';

export function loadConfig(cliOptions: CliOptions = {}): LoadedConfig {
	let fileConfig = { schemaVersion: 2 } as import('./loader/types').RawConfig;
	let baseDir: string | undefined;
	let configVersion: import('./loader').ConfigVersion = 'v2';

	if (cliOptions.config) {
		const result = readConfigFile(cliOptions.config);
		fileConfig = result.config;
		baseDir = result.baseDir;
		configVersion = detectConfigVersion(fileConfig);
	}

	const merged = mergeConfig(fileConfig, cliOptions, configVersion);
	const hasObfuscationToggles = hasObfuscationCliToggles(cliOptions);

	const validatorInstance = getValidator(configVersion);

	const configCopy = JSON.parse(JSON.stringify(merged)) as typeof merged;
	validateConfig(validatorInstance, configCopy);

	const pathNormalized = normalizePaths(configCopy, cliOptions, baseDir);

	if (cliOptions.mode || cliOptions.fallback) {
		pathNormalized.bundle = {
			...(pathNormalized.bundle || {}),
			...(cliOptions.mode ? { mode: cliOptions.mode } : {}),
			...(cliOptions.fallback ? { fallback: cliOptions.fallback } : {}),
		};
	}

	const normalizedV2 = normalizeToV2Config(pathNormalized);
	const outputConfig: LoadedConfig = {
		...normalizedV2,
		[LOADER_INTERNALS]: {
			analyzeOnly: false,
			warnings: [],
			configVersion,
		},
	};

	setConfigWarnings(outputConfig, collectWarnings({
		configVersion,
		mergedConfig: merged,
		hasObfuscationToggles,
	}));
	setConfigVersion(outputConfig, configVersion);

	for (const warning of getConfigWarnings(outputConfig)) {
		emitWarning(warning, cliOptions);
	}

	return outputConfig;
}
