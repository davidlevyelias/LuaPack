import fs from 'fs';

import type { ModuleRecord, WorkflowConfig } from '../analysis/types';

import type { BundlePlan } from './types';

export default class BundlePlanBuilder {
	constructor(private readonly config: WorkflowConfig) {}

	build(
		entryModule: ModuleRecord,
		sortedModules: ModuleRecord[]
	): BundlePlan {
		if (!entryModule || !entryModule.moduleName) {
			throw new Error(
				'Bundle plan requires an entry module with a module name.'
			);
		}
		if (!Array.isArray(sortedModules)) {
			throw new Error('Bundle plan requires a sorted module list.');
		}

		const bundledModules = [];
		const externalModuleSet = new Set<string>();
		const packagePrefixSet = new Set<string>();
		const packageDependencyModes: Record<
			string,
			Record<string, 'external' | 'ignore'>
		> = {};
		for (const packageName of Object.keys(this.config.packages || {})) {
			if (packageName && packageName !== 'default') {
				packagePrefixSet.add(packageName);
			}
		}

		for (const [packageName, packageConfig] of Object.entries(
			this.config.packages || {}
		)) {
			const scopedModes = Object.fromEntries(
				Object.entries(packageConfig?.dependencies || {}).flatMap(
					([dependencyName, policy]) => {
						if (
							policy?.mode !== 'external' &&
							policy?.mode !== 'ignore'
						) {
							return [];
						}

						return [[dependencyName, policy.mode]];
					}
				)
			) as Record<string, 'external' | 'ignore'>;

			if (Object.keys(scopedModes).length > 0) {
				packageDependencyModes[packageName] = scopedModes;
			}
		}

		for (const moduleRecord of sortedModules) {
			if (!moduleRecord || moduleRecord.isMissing) {
				continue;
			}

			const packageName = moduleRecord.packageName || 'default';
			if (packageName !== 'default') {
				packagePrefixSet.add(packageName);
			}

			if (moduleRecord.isIgnored) {
				continue;
			}

			if (moduleRecord.isExternal) {
				externalModuleSet.add(moduleRecord.moduleName);
				continue;
			}

			if (!moduleRecord.filePath) {
				continue;
			}

			const content =
				typeof moduleRecord.sourceContent === 'string'
					? moduleRecord.sourceContent
					: fs.readFileSync(moduleRecord.filePath, 'utf-8');
			const bundledModule = {
				moduleName: moduleRecord.moduleName,
				packageName,
				filePath: moduleRecord.filePath,
				content,
			};

			bundledModules.push(bundledModule);
		}

		return {
			entryModuleName: entryModule.moduleName,
			entryPackageName: entryModule.packageName || 'default',
			packagePrefixes: Array.from(packagePrefixSet).sort(
				(a, b) => b.length - a.length
			),
			bundledModules,
			externalModules: Array.from(externalModuleSet).sort(),
			packageDependencyModes,
			fallbackPolicy: this.config.bundle?.fallback || 'external-only',
		};
	}
}
