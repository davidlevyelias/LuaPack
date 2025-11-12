import type { ExternalSummary, ReporterAnalysis } from '../types';

export interface BuildExternalSummaryOptions {
	formatPath: (targetPath: string | null | undefined) => string;
}

type StringArray = string[];

function toStringArray(value: unknown): StringArray {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === 'string');
}

export function buildExternalSummary(
	analysis: ReporterAnalysis,
	{ formatPath }: BuildExternalSummaryOptions
): ExternalSummary {
	const externals = Array.isArray(analysis.externals) ? analysis.externals : [];
	const missingExternals = (analysis.missing || []).filter((missing) => missing.isExternal);
	const context = analysis.context;
	const externalsContext = context?.externals;

	const baseLabel = `${externals.length} ${externals.length === 1 ? 'module' : 'modules'}`;
	const displayLabel =
		missingExternals.length > 0
			? `${baseLabel} (${missingExternals.length} missing)`
			: baseLabel;

	const envContext = externalsContext?.env;
	const envNames = toStringArray(envContext?.names);
	const rawPathsByEnv = envContext?.pathsByEnv ?? {};
	const resolvedEnvPaths = toStringArray(envContext?.resolvedPaths);

	const envEntries = envNames.map((envName) => {
		const value = rawPathsByEnv[envName];
		const envPaths = toStringArray(value);
		return {
			name: envName,
			paths: envPaths.map((envPath) => formatPath(envPath)),
		};
	});
	const envHasPaths = envEntries.some((entry) => entry.paths.length > 0);
	const envNameLabel = envNames.length > 0 ? envNames.join(', ') : 'env';
	const envLabel = envHasPaths
		? `${envNameLabel} (${resolvedEnvPaths.length} ${
				resolvedEnvPaths.length === 1 ? 'path' : 'paths'
			})`
		: 'none';

	const recursiveFlag = externalsContext?.recursive;
	const rawExternalPaths = externalsContext?.paths;

	return {
		countLabel: displayLabel,
		missingCount: missingExternals.length,
		envLabel,
		verboseDetails: {
			recursive: typeof recursiveFlag === 'boolean' ? recursiveFlag : true,
			paths: toStringArray(rawExternalPaths).map((externalPath) => formatPath(externalPath)),
			modules: [
				...externals.map((module) => ({
					name: module.moduleName,
					tags: module.overrideApplied ? ['external', 'override'] : ['external'],
				})),
				...missingExternals.map((missing) => ({
					name: missing.moduleName || missing.requireId,
					tags: ['external', 'missing'],
				})),
			],
			env: {
				hasPaths: envHasPaths,
				totalPaths: resolvedEnvPaths.length,
				entries: envEntries,
			},
		},
	};
}
