import fs from 'fs';

import type { ModuleRecord, WorkflowConfig } from '../analysis/types';

import type { BundlePlan } from './types';

export default class BundlePlanBuilder {
	constructor(private readonly config: WorkflowConfig) {}

	build(entryModule: ModuleRecord, sortedModules: ModuleRecord[]): BundlePlan {
		if (!entryModule || !entryModule.moduleName) {
			throw new Error('Bundle plan requires an entry module with a module name.');
		}
		if (!Array.isArray(sortedModules)) {
			throw new Error('Bundle plan requires a sorted module list.');
		}

		const bundledModules = [];
		const externalModules: string[] = [];
		const ignoredModules: string[] = [];

		for (const moduleRecord of sortedModules) {
			if (!moduleRecord || moduleRecord.isMissing) {
				continue;
			}

			if (moduleRecord.isIgnored) {
				ignoredModules.push(moduleRecord.moduleName || moduleRecord.id);
				continue;
			}

			if (moduleRecord.isExternal) {
				externalModules.push(moduleRecord.moduleName);
				continue;
			}

			if (!moduleRecord.filePath) {
				continue;
			}

			bundledModules.push({
				moduleName: moduleRecord.moduleName,
				filePath: moduleRecord.filePath,
				content: fs.readFileSync(moduleRecord.filePath, 'utf-8'),
			});
		}

		return {
			entryModuleName: entryModule.moduleName,
			bundledModules,
			externalModules,
			ignoredModules,
			aliases: [],
			fallbackPolicy: this.config._v2?.bundle?.fallback || 'external-only',
			mode: this.config._v2?.bundle?.mode || 'runtime',
		};
	}
}