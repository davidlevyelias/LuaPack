const fs = require('fs');

class BundlePlanBuilder {
	constructor(config) {
		this.config = config;
	}

	build(entryModule, sortedModules) {
		if (!entryModule || !entryModule.moduleName) {
			throw new Error('Bundle plan requires an entry module with a module name.');
		}
		if (!Array.isArray(sortedModules)) {
			throw new Error('Bundle plan requires a sorted module list.');
		}

		const bundledModules = [];
		const externalModules = [];
		const ignoredModules = [];

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
			fallbackPolicy:
				this.config._v2?.bundle?.fallback || 'external-only',
			mode: this.config._v2?.bundle?.mode || 'runtime',
		};
	}
}

module.exports = BundlePlanBuilder;