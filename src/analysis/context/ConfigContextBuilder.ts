import { resolveExternalEnv } from '../../utils/env';
import type {
	AnalysisContext,
	FilePath,
	WorkflowConfig,
	WorkflowModulesExternalConfig,
} from '../types';

type ResolvedExternalEnv = {
	hasExplicitConfig: boolean;
	envNames: string[];
	pathsByEnv: Record<string, FilePath[]>;
	allPaths: FilePath[];
};

type ResolveExternalEnvOptions = {
	envConfig: WorkflowModulesExternalConfig['env'];
	sourceRoot: FilePath;
};

function clonePathsByEnv(pathsByEnv: Record<string, FilePath[]>): Record<string, FilePath[]> {
	const entries: Array<[string, FilePath[]]> = Object.entries(pathsByEnv).map(
		([envName, paths]) => [envName, [...paths]]
	);
	return Object.fromEntries(entries);
}

export function buildAnalysisContext(config: WorkflowConfig): AnalysisContext {
	const modulesConfig = config.modules ?? {};
	const externalConfig: WorkflowModulesExternalConfig = modulesConfig.external ?? {};
	const ignoredPatterns = Array.isArray(modulesConfig.ignore)
		? [...modulesConfig.ignore]
		: [];
	const externalPaths = Array.isArray(externalConfig.paths)
		? [...externalConfig.paths]
		: [];

	const envInfo = resolveExternalEnv({
		envConfig: externalConfig.env,
		sourceRoot: config.sourceRoot,
	} as ResolveExternalEnvOptions) as ResolvedExternalEnv;

	const envEntries = envInfo.envNames.map((envName) => ({
		name: envName,
		paths: [...(envInfo.pathsByEnv[envName] ?? [])],
	}));

	return {
		rootDir: config.sourceRoot,
		entryPath: config.entry,
		outputPath: config.output,
		analyzeOnly: Boolean(config._analyzeOnly),
		ignoredPatterns,
		ignoreMissing: Boolean(modulesConfig.ignoreMissing),
		externals: {
			enabled: Boolean(externalConfig.enabled),
			recursive:
				typeof externalConfig.recursive === 'boolean'
					? externalConfig.recursive
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
