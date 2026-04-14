import path from 'path';

import { isAnalyzeOnlyConfig } from '../../config/loader';
import type { AnalysisContext, WorkflowConfig } from '../types';

function getScopedModuleName(packageName: string, moduleId: string): string {
	if (packageName === 'default') {
		return moduleId;
	}
	if (moduleId === 'init') {
		return packageName;
	}
	return `${packageName}.${moduleId}`;
}

export function buildAnalysisContext(config: WorkflowConfig): AnalysisContext {
	const packageEntries = Object.entries(config.packages || {});
	const configuredRoots = Array.from(
		new Set(
			packageEntries
				.map(([, packageConfig]) => packageConfig?.root)
				.filter((rootPath): rootPath is string => Boolean(rootPath))
		)
	);
	const sourceRoot =
		config.packages?.default?.root || configuredRoots[0] || path.dirname(config.entry);
	const ignoredPatterns = packageEntries.flatMap(([packageName, packageConfig]) =>
		Object.entries(packageConfig.rules || {})
			.filter(([, rule]) => rule?.mode === 'ignore')
			.map(([moduleId]) => getScopedModuleName(packageName, moduleId))
	);
	const externalPackageNames = new Set(
		packageEntries.flatMap(([packageName, packageConfig]) =>
			Object.values(packageConfig.dependencies || {}).some(
				(dependency) => dependency?.mode === 'external'
			)
				? [packageName]
				: []
		)
	);
	const externalPaths = packageEntries
		.filter(([packageName]) => packageName !== 'default')
		.map(([, packageConfig]) => packageConfig.root);
	const hasExplicitExternalRules = packageEntries.some(([, packageConfig]) =>
		Object.values(packageConfig.rules || {}).some(
			(rule) => rule?.mode === 'external'
		)
	);

	return {
		rootDir: sourceRoot,
		roots: [...configuredRoots],
		packages: packageEntries
			.filter(([, packageConfig]) => Boolean(packageConfig?.root))
			.map(([packageName, packageConfig]) => ({
				name: packageName,
				root: packageConfig.root,
				isEntry: packageName === (config._internal?.entryPackage || 'default'),
			})),
		entryPath: config.entry,
		outputPath: config.output,
		luaVersion: config.luaVersion,
		analyzeOnly: isAnalyzeOnlyConfig(config),
		ignoredPatterns,
		missingPolicy: config.missing,
		fallbackPolicy: config.bundle.fallback,
		externals: {
			enabled:
				hasExplicitExternalRules || externalPackageNames.size > 0,
			recursive: true,
			paths: externalPaths,
		},
	};
}
