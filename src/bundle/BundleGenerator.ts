import fs from 'fs';
import path from 'path';

import type { BundlePlan } from './types';

const TEMPLATE_PLACEHOLDERS = {
	modules: '-- __MODULE_DEFINITIONS__',
	externals: '-- __EXTERNAL_MODULES__',
	fallback: '-- __FALLBACK_LOGIC__',
	entry: /__ENTRY_MODULE__/g,
};

const templateCache = new Map<string, string>();

function getTemplate(): string {
	const templateName = 'runtime.lua';
	if (!templateCache.has(templateName)) {
		const templatePath = path.resolve(__dirname, `../../templates/${templateName}`);
		templateCache.set(templateName, fs.readFileSync(templatePath, 'utf-8'));
	}
	return templateCache.get(templateName)!;
}

function buildExternalModuleSection(externalModules: string[]): string {
	return externalModules.map((moduleName) => `	["${moduleName}"] = true,`).join('\n');
}

function buildFallbackLogic(fallbackPolicy: BundlePlan['fallbackPolicy']): string {
	if (fallbackPolicy === 'never') {
		return '    return false';
	}

	if (fallbackPolicy === 'always') {
		return '    return true';
	}

	return '    return external_modules[module_name] == true';
}

export default class BundleGenerator {
	createBundleTemplate(bundlePlan: BundlePlan): string {
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

		const definitionsSection = moduleDefinitions ? `${moduleDefinitions}\n` : '';
		const externalModulesSection = buildExternalModuleSection(
			bundlePlan.externalModules
		);
		const fallbackLogic = buildFallbackLogic(bundlePlan.fallbackPolicy);

		return getTemplate()
			.replace(TEMPLATE_PLACEHOLDERS.modules, definitionsSection)
			.replace(TEMPLATE_PLACEHOLDERS.externals, externalModulesSection)
			.replace(TEMPLATE_PLACEHOLDERS.fallback, fallbackLogic)
			.replace(TEMPLATE_PLACEHOLDERS.entry, bundlePlan.entryModuleName);
	}

	async generateBundle(bundlePlan: BundlePlan): Promise<string> {
		return this.createBundleTemplate(bundlePlan);
	}
}