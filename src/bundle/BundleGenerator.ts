import fs from 'fs';
import path from 'path';

import type { BundlePlan } from './types';

const TEMPLATE_PLACEHOLDERS = {
	modules: '-- __MODULE_DEFINITIONS__',
	externals: '-- __EXTERNAL_MODULES__',
	packagePrefixes: '-- __PACKAGE_PREFIXES__',
	fallback: '-- __FALLBACK_LOGIC__',
	entry: /__ENTRY_MODULE__/g,
	entryPackage: /__ENTRY_PACKAGE__/g,
};

const templateCache = new Map<string, string>();

function getTemplate(): string {
	const templateName = 'runtime.lua';
	if (!templateCache.has(templateName)) {
		const templatePath = path.resolve(
			__dirname,
			`../../templates/${templateName}`
		);
		templateCache.set(templateName, fs.readFileSync(templatePath, 'utf-8'));
	}
	return templateCache.get(templateName)!;
}

function buildExternalModuleSection(externalModules: string[]): string {
	return externalModules
		.map((moduleName) => `	["${moduleName}"] = true,`)
		.join('\n');
}

function buildPackagePrefixSection(packagePrefixes: string[]): string {
	return packagePrefixes
		.map((packageName) => `	"${packageName}",`)
		.join('\n');
}

function buildFallbackLogic(
	fallbackPolicy: BundlePlan['fallbackPolicy']
): string {
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
		const bundledModules = Array.isArray(bundlePlan.bundledModules)
			? bundlePlan.bundledModules
			: [];
		const externalModules = Array.isArray(bundlePlan.externalModules)
			? bundlePlan.externalModules
			: [];
		const packagePrefixes = Array.isArray(bundlePlan.packagePrefixes)
			? bundlePlan.packagePrefixes
			: [];
		const entryPackageName = bundlePlan.entryPackageName || 'default';
		const moduleDefinitions = bundledModules
			.map(({ moduleName, packageName, content }) => {
				const normalizedContent = content
					.replace(/\r\n/g, '\n')
					.replace(/\r/g, '\n');
				const scopedRequirePrelude = `local require = __lp_require_scoped("${packageName || 'default'}")`;
				const moduleBody = `${scopedRequirePrelude}\n${normalizedContent}`;
				const indentedContent = moduleBody
					.split('\n')
					.map((line) => (line.length ? `\t${line}` : ''))
					.join('\n');
				return `modules["${moduleName}"] = function(...)
${indentedContent}
end`;
			})
			.join('\n\n');

		const definitionsSection = moduleDefinitions
			? `${moduleDefinitions}\n`
			: '';
		const externalModulesSection = buildExternalModuleSection(
			externalModules
		);
		const packagePrefixSection = buildPackagePrefixSection(
			packagePrefixes
		);
		const fallbackLogic = buildFallbackLogic(bundlePlan.fallbackPolicy);

		return getTemplate()
			.replace(TEMPLATE_PLACEHOLDERS.modules, definitionsSection)
			.replace(TEMPLATE_PLACEHOLDERS.externals, externalModulesSection)
			.replace(TEMPLATE_PLACEHOLDERS.packagePrefixes, packagePrefixSection)
			.replace(TEMPLATE_PLACEHOLDERS.fallback, fallbackLogic)
			.replace(TEMPLATE_PLACEHOLDERS.entry, bundlePlan.entryModuleName)
			.replace(
				TEMPLATE_PLACEHOLDERS.entryPackage,
				entryPackageName
			);
	}

	async generateBundle(bundlePlan: BundlePlan): Promise<string> {
		return this.createBundleTemplate(bundlePlan);
	}
}
