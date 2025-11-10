const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const luamin = require('lua-format/src/luamin.js');
const BundleGenerator = require('./BundleGenerator');
const AsciiObfuscator = require('./obfuscation/AsciiObfuscator');
const logger = require('./Logger');

const FIRST_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
const SUBSEQUENT_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const IDENTIFIER_PATTERN = /\b[LG]_\d+_[A-Za-z0-9]*\b/g;
const LUA_KEYWORDS = new Set([
	'and',
	'break',
	'do',
	'else',
	'elseif',
	'end',
	'false',
	'for',
	'function',
	'goto',
	'if',
	'in',
	'local',
	'nil',
	'not',
	'or',
	'repeat',
	'return',
	'then',
	'true',
	'until',
	'while',
]);

class LuaPacker {
	constructor(config) {
		this.config = this.normalizeConfig(config);
	}

	normalizeConfig(config) {
		const sourceRoot = config.sourceRoot
			? path.resolve(config.sourceRoot)
			: path.dirname(path.resolve(config.entry));
		const defaultObfuscation = {
			tool: 'none',
			config: {
				minify: false,
				renameVariables: {
					enabled: false,
					min: 5,
					max: 5,
				},
				ascii: false,
			},
		};
		const incomingObfuscation = config.obfuscation || {};
		const mergedObfuscation = {
			...defaultObfuscation,
			...incomingObfuscation,
			config: {
				...defaultObfuscation.config,
				...(incomingObfuscation.config || {}),
			},
		};
		mergedObfuscation.config.renameVariables =
			LuaPacker.normalizeRenameConfig(
				mergedObfuscation.config.renameVariables
			);
		return {
			...config,
			entry: path.resolve(config.entry),
			output: config.output
				? path.resolve(config.output)
				: path.resolve('bundle.lua'),
			sourceRoot,
			obfuscation: mergedObfuscation,
		};
	}

	static normalizeRenameConfig(renameValue) {
		const defaults = {
			enabled: false,
			min: 5,
			max: 5,
		};

		if (typeof renameValue === 'boolean') {
			return {
				...defaults,
				enabled: renameValue,
			};
		}

		if (renameValue && typeof renameValue === 'object') {
			const enabled =
				typeof renameValue.enabled === 'boolean'
					? renameValue.enabled
					: defaults.enabled;
			const min = LuaPacker.clampInteger(
				renameValue.min,
				1,
				Number.MAX_SAFE_INTEGER,
				defaults.min
			);
			const max = LuaPacker.clampInteger(
				renameValue.max,
				min,
				Number.MAX_SAFE_INTEGER,
				Math.max(min, defaults.max)
			);

			return {
				enabled,
				min,
				max,
			};
		}

		return { ...defaults };
	}

	static clampInteger(value, min, max, fallback) {
		const intValue = Number.parseInt(value, 10);
		if (Number.isInteger(intValue)) {
			return Math.min(Math.max(intValue, min), max);
		}
		return fallback;
	}

	getConfig() {
		return this.config;
	}

	async pack(analysisResult) {
		if (!analysisResult) {
			throw new Error('Analysis result is required to create a bundle.');
		}

		const { entryModule, sortedModules } = analysisResult;
		if (!entryModule || !Array.isArray(sortedModules)) {
			throw new Error(
				'Analysis result must include entryModule and sortedModules.'
			);
		}

		const generator = new BundleGenerator(this.config);
		const bundleContent = await generator.generateBundle(
			entryModule,
			sortedModules
		);
		const finalContent = this.applyObfuscation(bundleContent);

		const outputDir = path.dirname(this.config.output);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(this.config.output, finalContent);
		try {
			const bundleStats = fs.statSync(this.config.output);
			if (
				analysisResult.metrics &&
				Number.isFinite(bundleStats.size)
			) {
				analysisResult.metrics.bundleSizeBytes = bundleStats.size;
			}
		} catch (error) {
			logger.warn?.(
				`Failed to read bundle size for '${this.config.output}': ${error.message}`
			);
		}

		logger.info(`Bundle successfully created at: ${this.config.output}`);
	}

	applyObfuscation(bundleContent) {
		const obfuscation = this.config.obfuscation || { tool: 'none', config: {} };
		if (obfuscation.tool !== 'internal') {
			return bundleContent;
		}

		const { config: obfConfig = {} } = obfuscation;
		const renameConfig = obfConfig.renameVariables || { enabled: false };
		const shouldRename = Boolean(renameConfig.enabled);
		const shouldMinify = Boolean(obfConfig.minify);
		let transformed = bundleContent;

		if (shouldMinify) {
			const options = {};
			if (shouldRename) {
				options.RenameVariables = true;
				options.RenameGlobals = true;
			}
			transformed = luamin.Minify(transformed, options);
		} else if (shouldRename) {
			const beautifyOptions = {
				RenameVariables: true,
				RenameGlobals: true,
			};
			transformed = luamin.Beautify(transformed, beautifyOptions);
			transformed = this.stripLuaminWatermark(transformed);
		}

		if (shouldRename) {
			transformed = this.applyRenameTemplates(
				transformed,
				renameConfig
			);
		}

		if (obfConfig.ascii) {
			const chunkName = path.basename(this.config.output) || 'luapack_bundle.lua';
			transformed = AsciiObfuscator.encode(transformed, chunkName);
		}

		return transformed;
	}

	stripLuaminWatermark(content) {
		if (typeof content !== 'string') {
			return content;
		}
		const watermarkPattern = /^--\[\[[\s\S]*?\]\]\s*/;
		return content.replace(watermarkPattern, '');
	}

	applyRenameTemplates(content, renameConfig) {
		if (typeof content !== 'string') {
			return content;
		}
		const matches = content.match(IDENTIFIER_PATTERN);
		if (!matches || matches.length === 0) {
			return content;
		}

		const uniqueIdentifiers = Array.from(new Set(matches));
		const replacements = new Map();
		const usedNames = new Set();
		const minLength = Math.max(1, Number.parseInt(renameConfig.min, 10) || 1);
		const maxLength = Math.max(minLength, Number.parseInt(renameConfig.max, 10) || minLength);

		for (const identifier of uniqueIdentifiers) {
			let candidate;
			let attempt = 0;
			do {
				candidate = generateRandomName(minLength, maxLength);
				attempt += 1;
				if (attempt > 10_000) {
					throw new Error('Failed to generate a unique obfuscated identifier.');
				}
			} while (LUA_KEYWORDS.has(candidate) || usedNames.has(candidate));
			usedNames.add(candidate);
			replacements.set(identifier, candidate);
		}

		return content.replace(IDENTIFIER_PATTERN, (match) => {
			const replacement = replacements.get(match);
			return replacement || match;
		});
	}
}

module.exports = LuaPacker;

function generateRandomName(minLength, maxLength) {
	const targetLength =
		minLength === maxLength
			? minLength
			: minLength + crypto.randomInt(Math.max(1, maxLength - minLength + 1));

	let name = FIRST_CHARSET.charAt(crypto.randomInt(FIRST_CHARSET.length));
	while (name.length < targetLength) {
		name += SUBSEQUENT_CHARSET.charAt(
			crypto.randomInt(SUBSEQUENT_CHARSET.length)
		);
	}
	return name;
}
