import fs from 'fs';
import path from 'path';

import logger from '../utils/Logger';
import type {
	AnalysisResult,
	ModuleRecord,
	WorkflowConfig,
} from '../analysis/types';

import BundleGenerator from './BundleGenerator';
import BundlePlanBuilder from './BundlePlanBuilder';

export default class LuaPacker {
	private readonly config: WorkflowConfig;

	constructor(config: WorkflowConfig) {
		this.config = this.normalizeConfig(config);
	}

	private normalizeConfig(config: WorkflowConfig): WorkflowConfig {
		const entry = path.resolve(config.entry);
		const output = config.output
			? path.resolve(config.output)
			: path.resolve('bundle.lua');
		const defaultRoot =
			config.packages?.default?.root || path.dirname(entry);
		const normalizedPackages = Object.fromEntries(
			Object.entries(config.packages || {
				default: {
					root: defaultRoot,
					dependencies: {},
					rules: {},
				},
			}).map(([packageName, packageConfig]) => [
				packageName,
				{
					root: path.resolve(packageConfig.root),
					dependencies: { ...(packageConfig.dependencies || {}) },
					rules: { ...(packageConfig.rules || {}) },
				},
			])
		);

		return {
			...config,
			entry,
			output,
			missing: config.missing || 'error',
			packages: normalizedPackages,
			bundle: {
				fallback: config.bundle?.fallback || 'external-only',
			},
			_internal: {
				entryPackage: config._internal?.entryPackage || 'default',
				entryKind: config._internal?.entryKind || 'package-module',
			},
		};
	}

	getConfig(): WorkflowConfig {
		return this.config;
	}

	async pack(analysisResult: AnalysisResult): Promise<string> {
		if (!analysisResult) {
			throw new Error('Analysis result is required to create a bundle.');
		}

		const { entryModule, sortedModules } = analysisResult;
		const hasEntryModule = Boolean(
			entryModule &&
			typeof entryModule.moduleName === 'string' &&
			typeof entryModule.filePath === 'string'
		);
		if (!hasEntryModule || !Array.isArray(sortedModules)) {
			throw new Error(
				'Analysis result must include entryModule and sortedModules.'
			);
		}

		const entryRecord = entryModule as ModuleRecord;

		const generator = new BundleGenerator();
		const planBuilder = new BundlePlanBuilder(this.config);
		const bundlePlan = planBuilder.build(entryRecord, sortedModules);
		const bundleContent = await generator.generateBundle(bundlePlan);

		const outputDir = path.dirname(this.config.output);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		fs.writeFileSync(this.config.output, bundleContent);
		try {
			const bundleStats = fs.statSync(this.config.output);
			if (analysisResult.metrics && Number.isFinite(bundleStats.size)) {
				analysisResult.metrics.bundleSizeBytes = bundleStats.size;
			}
		} catch (error) {
			const typedError = error as Error;
			logger.warn?.(
				`Failed to read bundle size for '${this.config.output}': ${typedError.message}`
			);
		}

		return this.config.output;
	}
}
