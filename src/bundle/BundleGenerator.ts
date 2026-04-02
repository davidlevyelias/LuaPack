import fs from 'fs';
import path from 'path';

import type { BundlePlan } from './types';

const TEMPLATE_PLACEHOLDERS = {
	modules: '-- __MODULE_DEFINITIONS__',
	entry: /__ENTRY_MODULE__/g,
};

let defaultTemplateCache: string | null = null;

function getDefaultTemplate(): string {
	if (!defaultTemplateCache) {
		const templatePath = path.resolve(__dirname, '../../templates/default.lua');
		defaultTemplateCache = fs.readFileSync(templatePath, 'utf-8');
	}
	return defaultTemplateCache;
}

export default class BundleGenerator {
	constructor(private readonly config: Record<string, unknown>) {}

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

		return getDefaultTemplate()
			.replace(TEMPLATE_PLACEHOLDERS.modules, definitionsSection)
			.replace(TEMPLATE_PLACEHOLDERS.entry, bundlePlan.entryModuleName);
	}

	async generateBundle(bundlePlan: BundlePlan): Promise<string> {
		void this.config;
		return this.createBundleTemplate(bundlePlan);
	}
}