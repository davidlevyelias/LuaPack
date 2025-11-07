const fs = require('fs');
const path = require('path');
const luamin = require('lua-format/src/luamin.js');
const AsciiObfuscator = require('./obfuscation/AsciiObfuscator');

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
			let content = fs.readFileSync(moduleRecord.filePath, 'utf-8');

			const obfuscation = this.config.obfuscation || {
				tool: 'none',
				config: {},
			};
			let transformedContent = content;
			if (obfuscation.tool === 'internal') {
				const {
					minify = false,
					renameVariables = {
						enabled: false,
						min: 5,
						max: 5,
					},
					ascii = false,
				} = obfuscation.config || {};
				const renameConfig =
					BundleGenerator.normalizeRenameConfig(renameVariables);
				const renameEnabled = renameConfig.enabled;
				if (minify || renameEnabled) {
					const options = {};
					if (renameEnabled) {
						options.RenameVariables = true;
						options.RenameGlobals = true;
					}
					transformedContent = luamin.Minify(
						transformedContent,
						options
					);
				}

				if (ascii) {
					transformedContent = AsciiObfuscator.encode(
						transformedContent,
						moduleName
					);
				}
			}

			modules[moduleName] = transformedContent;
		}

		const entryModuleName = entryModule.moduleName;

		return this.createBundleTemplate(modules, entryModuleName);
	}
}

BundleGenerator.normalizeRenameConfig = function normalizeRenameConfig(value) {
	const defaults = { enabled: false, min: 5, max: 5 };
	if (typeof value === 'boolean') {
		return { ...defaults, enabled: value };
	}
	if (value && typeof value === 'object') {
		const min =
			Number.isInteger(value.min) && value.min > 0 ? value.min : 5;
		let max =
			Number.isInteger(value.max) && value.max > 0 ? value.max : min;
		if (max < min) {
			max = min;
		}
		return {
			enabled: Boolean(
				typeof value.enabled === 'boolean'
					? value.enabled
					: defaults.enabled
			),
			min,
			max,
		};
	}
	return { ...defaults };
};

module.exports = BundleGenerator;
