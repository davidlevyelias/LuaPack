const fs = require('fs');
const path = require('path');
const TEMPLATE_PLACEHOLDERS = {
	modules: '-- __MODULE_DEFINITIONS__',
	entry: /__ENTRY_MODULE__/g,
};

let defaultTemplateCache = null;

function getDefaultTemplate() {
	if (!defaultTemplateCache) {
		const templatePath = path.resolve(
			__dirname,
			'../templates/default.lua'
		);
		defaultTemplateCache = fs.readFileSync(templatePath, 'utf-8');
	}
	return defaultTemplateCache;
}

class BundleGenerator {
	createBundleTemplate(modules, entryModule) {
		const moduleDefinitions = Object.entries(modules)
			.map(([name, content]) => {
				const normalizedContent = content
					.replace(/\r\n/g, '\n')
					.replace(/\r/g, '\n');
				const indentedContent = normalizedContent
					.split('\n')
					.map((line) => (line.length ? `\t${line}` : ''))
					.join('\n');
				return `modules["${name}"] = function(...)
${indentedContent}
end`;
			})
			.join('\n\n');

		const template = getDefaultTemplate();
		const definitionsSection = moduleDefinitions
			? `${moduleDefinitions}\n`
			: '';

		return template
			.replace(TEMPLATE_PLACEHOLDERS.modules, definitionsSection)
			.replace(TEMPLATE_PLACEHOLDERS.entry, entryModule);
	}

	constructor(config) {
		this.config = config;
	}

	async generateBundle(entryModule, sortedModules) {
		const modules = {};

		for (const moduleRecord of sortedModules) {
			if (!moduleRecord.filePath) {
				continue;
			}

			const moduleName = moduleRecord.moduleName;
			const content = fs.readFileSync(moduleRecord.filePath, 'utf-8');
			modules[moduleName] = content;
		}

		const entryModuleName = entryModule.moduleName;

		return this.createBundleTemplate(modules, entryModuleName);
	}
}

module.exports = BundleGenerator;
