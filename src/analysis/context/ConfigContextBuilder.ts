import path from 'path';

import { isAnalyzeOnlyConfig } from '../../config/loader';
import type { AnalysisContext, WorkflowConfig } from '../types';

export function buildAnalysisContext(config: WorkflowConfig): AnalysisContext {
	const modulesConfig = config.modules;
	const configuredRoots =
		Array.isArray(modulesConfig.roots) && modulesConfig.roots.length > 0
			? modulesConfig.roots
			: [path.dirname(config.entry)];
	const sourceRoot = configuredRoots[0] ?? path.dirname(config.entry);
	const ignoredPatterns = Object.entries(modulesConfig.rules)
		.filter(([, rule]) => rule?.mode === 'ignore')
		.map(([moduleId]) => moduleId);
	const externalPaths = configuredRoots.slice(1);
	const hasExplicitExternalRules = Object.values(modulesConfig.rules).some(
		(rule) => rule?.mode === 'external'
	);

	return {
		rootDir: sourceRoot,
		roots: [...configuredRoots],
		entryPath: config.entry,
		outputPath: config.output,
		analyzeOnly: isAnalyzeOnlyConfig(config),
		ignoredPatterns,
		missingPolicy: modulesConfig.missing,
		fallbackPolicy: config.bundle.fallback,
		externals: {
			enabled: hasExplicitExternalRules || externalPaths.length > 0,
			recursive:
				typeof config._compat?.externalRecursive === 'boolean'
					? config._compat.externalRecursive
					: true,
			paths: externalPaths,
		},
	};
}
