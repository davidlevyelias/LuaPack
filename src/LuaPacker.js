const path = require('path');
const fs = require('fs');
const BundleGenerator = require('./BundleGenerator');
const logger = require('./Logger');

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

		const outputDir = path.dirname(this.config.output);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(this.config.output, bundleContent);

		logger.info(`Bundle successfully created at: ${this.config.output}`);
	}
}

module.exports = LuaPacker;
