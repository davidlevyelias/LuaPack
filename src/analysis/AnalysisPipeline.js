const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const DependencyAnalyzer = require('../DependencyAnalyzer');
const { resolveExternalEnv } = require('../utils/env');

class AnalysisPipeline {
	constructor(config, { logger } = {}) {
		this.config = config;
		this.logger = logger || console;
		this.analyzer = new DependencyAnalyzer(config);
	}

	run() {
		const start = performance.now();

		const analysis = {
			entryModule: null,
			modules: [],
			moduleById: new Map(),
			dependencyGraph: new Map(),
			sortedModules: [],
			topologicalOrder: [],
			externals: [],
			missing: [],
			warnings: [],
			errors: [],
			metrics: {
				moduleCount: 0,
				externalCount: 0,
				missingCount: 0,
				moduleSizeSum: 0,
				estimatedBundleSize: 0,
				bundleSizeBytes: 0,
			},
			obfuscation: this.getObfuscationConfig(),
			context: this.buildContext(),
			success: true,
			durationMs: 0,
		};

		let graph;
		try {
			const result = this.analyzer.buildDependencyGraph(this.config.entry);
			graph = result.graph;
			analysis.entryModule = result.entryModule;
			analysis.missing = result.missing.map((item) => this.formatMissing(item));
			analysis.metrics.missingCount = analysis.missing.length;
			if (result.errors && result.errors.length > 0) {
				for (const err of result.errors) {
					analysis.errors.push(err);
				}
			}
		} catch (error) {
			analysis.errors.push(error);
			analysis.success = false;
			analysis.durationMs = performance.now() - start;
			return analysis;
		}

		if (!graph || graph.size === 0) {
			analysis.durationMs = performance.now() - start;
			return analysis;
		}

		this.populateModuleCollections(graph, analysis);

		try {
			const sorted = this.analyzer.topologicalSort(graph);
			analysis.sortedModules = sorted.filter((moduleRecord) => !moduleRecord.isMissing);
			analysis.topologicalOrder = analysis.sortedModules.map(
				(moduleRecord) => moduleRecord.moduleName
			);
		} catch (error) {
			analysis.errors.push(error);
			analysis.success = false;
			analysis.sortedModules = [];
			analysis.topologicalOrder = [];
		}

		analysis.metrics.moduleCount = analysis.modules.length;
		analysis.metrics.externalCount = analysis.externals.length;
		analysis.metrics.moduleSizeSum = this.computeModuleSizeSum(
			analysis.modules
		);
		analysis.metrics.estimatedBundleSize = analysis.metrics.moduleSizeSum;

		const warningSet = new Set(analysis.warnings);
		for (const missingEntry of analysis.missing) {
			if (!missingEntry) {
				continue;
			}
			const isOverrideWarning =
				missingEntry.overrideApplied && !missingEntry.fatal && missingEntry.message;
			if (isOverrideWarning && !warningSet.has(missingEntry.message)) {
				analysis.warnings.push(missingEntry.message);
				warningSet.add(missingEntry.message);
			}
		}

		analysis.durationMs = performance.now() - start;
		analysis.success = analysis.errors.length === 0;

		return analysis;
	}

	buildContext() {
		const modulesConfig = this.config.modules || {};
		const externalConfig = modulesConfig.external || {};
		const ignoredPatterns = Array.isArray(modulesConfig.ignore)
			? [...modulesConfig.ignore]
			: [];
		const externalPaths = Array.isArray(externalConfig.paths)
			? [...externalConfig.paths]
			: [];
		const envInfo = resolveExternalEnv({
			envConfig: externalConfig.env,
			sourceRoot: this.config.sourceRoot,
		});

		return {
			rootDir: this.config.sourceRoot,
			entryPath: this.config.entry,
			outputPath: this.config.output,
			analyzeOnly: Boolean(this.config._analyzeOnly),
			ignoredPatterns,
			ignoreMissing: Boolean(modulesConfig.ignoreMissing),
			externals: {
				enabled: Boolean(externalConfig.enabled),
				recursive:
					typeof externalConfig.recursive === 'boolean'
						? externalConfig.recursive
						: true,
				paths: externalPaths,
				env: {
					hasExplicitConfig: envInfo.hasExplicitConfig,
					names: envInfo.envNames,
					pathsByEnv: envInfo.pathsByEnv,
					resolvedPaths: envInfo.allPaths,
				},
			},
		};
	}

	populateModuleCollections(graph, analysis) {
		const moduleMap = new Map();

		for (const node of graph.values()) {
			if (!node || !node.module) {
				continue;
			}

			const moduleRecord = node.module;
			moduleMap.set(moduleRecord.id, moduleRecord);

			const dependencies = [];
			for (const dep of node.dependencies || []) {
				if (!dep) {
					continue;
				}
				dependencies.push({
					id: dep.id,
					moduleName: dep.moduleName,
					isExternal: Boolean(dep.isExternal),
					isMissing: Boolean(dep.isMissing),
					filePath: dep.filePath || null,
				});

				if (!moduleMap.has(dep.id)) {
					moduleMap.set(dep.id, dep);
				}
			}

			analysis.dependencyGraph.set(moduleRecord.id, dependencies);
		}

		analysis.moduleById = moduleMap;
		analysis.modules = Array.from(moduleMap.values()).filter(
			(moduleRecord) => !moduleRecord.isMissing
		);
		analysis.externals = analysis.modules.filter((module) =>
			module.isExternal === true
		);
	}

	getObfuscationConfig() {
		const toolConfig = this.config.obfuscation || { config: {} };
		const obfConfig = toolConfig.config || {};
		const rename = this.normalizeRenameConfig(obfConfig.renameVariables);
		return {
			tool: toolConfig.tool || 'none',
			rename,
			minify: Boolean(obfConfig.minify),
			ascii: Boolean(obfConfig.ascii),
		};
	}

	normalizeRenameConfig(renameValue) {
		const defaults = { enabled: false, min: 5, max: 5 };
		if (typeof renameValue === 'boolean') {
			return { ...defaults, enabled: renameValue };
		}
		if (renameValue && typeof renameValue === 'object') {
			const min = Number.isInteger(renameValue.min) && renameValue.min > 0
				? renameValue.min
				: defaults.min;
			let max = Number.isInteger(renameValue.max) && renameValue.max > 0
				? renameValue.max
				: Math.max(min, defaults.max);
			if (max < min) {
				max = min;
			}
			const enabled =
				typeof renameValue.enabled === 'boolean'
					? renameValue.enabled
					: defaults.enabled;
			return { enabled, min, max };
		}
		return { ...defaults };
	}

	computeModuleSizeSum(modules) {
		let total = 0;
		for (const moduleRecord of modules) {
			if (!moduleRecord || !moduleRecord.filePath) {
				continue;
			}

			try {
				const stats = fs.statSync(moduleRecord.filePath);
				if (Number.isFinite(stats.size)) {
					total += stats.size;
				}
			} catch (error) {
				this.logger.warn?.(
					`Failed to read size for module '${moduleRecord.moduleName}': ${error.message}`
				);
			}
		}
		return total;
	}

	formatMissing(item) {
		const parentName = item.requiredBy?.moduleName || item.requiredBy?.id;
		const record = item.record || {};
		return {
			requiredBy: parentName || null,
			requireId: item.requireId,
			moduleName: record.moduleName || item.requireId,
			filePath: record.filePath || null,
			isExternal: Boolean(record.isExternal),
			overrideApplied: Boolean(record.overrideApplied),
			fatal: Boolean(item.fatal),
			message: item.error ? item.error.message : 'Module was marked missing.',
		};
	}
}

module.exports = AnalysisPipeline;
