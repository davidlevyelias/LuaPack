import path from 'path';

import { resolveExternalEnv } from '../../utils/env';
import { isAnalyzeOnlyConfig } from '../../config/loader';
import type {
	AnalysisContext,
	FilePath,
	WorkflowConfig,
} from '../types';

type ResolvedExternalEnv = {
	hasExplicitConfig: boolean;
	envNames: string[];
	pathsByEnv: Record<string, FilePath[]>;
	allPaths: FilePath[];
};

type ResolveExternalEnvOptions = {
	envConfig: string[];
	sourceRoot: FilePath;
};

function clonePathsByEnv(pathsByEnv: Record<string, FilePath[]>): Record<string, FilePath[]> {
	const entries: Array<[string, FilePath[]]> = Object.entries(pathsByEnv).map(
		([envName, paths]) => [envName, [...paths]]
	);
	return Object.fromEntries(entries);
}

export function buildAnalysisContext(config: WorkflowConfig): AnalysisContext {
	const modulesConfig = config.modules;
	const sourceRoot = modulesConfig.roots[0] ?? path.dirname(config.entry);
	const ignoredPatterns = Object.entries(modulesConfig.rules)
		.filter(([, rule]) => rule?.mode === 'ignore')
		.map(([moduleId]) => moduleId);
	const externalPaths = modulesConfig.roots.slice(1);
	const hasExplicitExternalRules = Object.values(modulesConfig.rules).some(
		(rule) => rule?.mode === 'external'
	);

	const envInfo = resolveExternalEnv({
		envConfig: modulesConfig.env,
		sourceRoot,
	} as ResolveExternalEnvOptions) as ResolvedExternalEnv;

	const envEntries = envInfo.envNames.map((envName) => ({
		name: envName,
		paths: [...(envInfo.pathsByEnv[envName] ?? [])],
	}));

	return {
		rootDir: sourceRoot,
		entryPath: config.entry,
		outputPath: config.output,
		analyzeOnly: isAnalyzeOnlyConfig(config),
		ignoredPatterns,
		ignoreMissing: modulesConfig.missing !== 'error',
		externals: {
			enabled:
				hasExplicitExternalRules ||
				externalPaths.length > 0 ||
				envInfo.allPaths.length > 0,
			recursive:
				typeof config._compat?.externalRecursive === 'boolean'
					? config._compat.externalRecursive
					: true,
			paths: externalPaths,
			env: {
				hasExplicitConfig: Boolean(envInfo.hasExplicitConfig),
				names: [...envInfo.envNames],
				pathsByEnv: clonePathsByEnv(envInfo.pathsByEnv),
				resolvedPaths: [...envInfo.allPaths],
				entries: envEntries,
			},
		},
	};
}
