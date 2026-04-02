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
	createBundleTemplate(bundlePlan) {
		const moduleDefinitions = bundlePlan.bundledModules
			.map(({ moduleName, content }) => {
				const normalizedContent = content
					.replace(/\r\n/g, '\n')
					.replace(/\r/g, '\n');
				const indentedContent = normalizedContent
					.split('\n')
					.map((line) => (line.length ? `\t${line}` : ''))
					.join('\n');
				return `modules["${moduleName}"] = function(...)
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
			.replace(TEMPLATE_PLACEHOLDERS.entry, bundlePlan.entryModuleName);
	}

	constructor(config) {
		this.config = config;
	}

	async generateBundle(bundlePlan) {
		return this.createBundleTemplate(bundlePlan);
	}
}

module.exports = BundleGenerator;
