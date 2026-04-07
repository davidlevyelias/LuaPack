import type { ExternalSummary, ReporterAnalysis } from '../types';
import { normalizeExternalSummaryData } from '../utils/externalSummary';

export interface BuildExternalSummaryOptions {
	formatPath: (targetPath: string | null | undefined) => string;
}

export function buildExternalSummary(
	analysis: ReporterAnalysis,
	{ formatPath }: BuildExternalSummaryOptions
): ExternalSummary {
	const {
		externals,
		missingExternals,
		externalPaths,
		recursive,
		envNames,
		resolvedEnvPaths,
		pathsByEnv,
	} = normalizeExternalSummaryData(analysis);

	const baseLabel = `${externals.length} ${externals.length === 1 ? 'module' : 'modules'}`;
	const displayLabel =
		missingExternals.length > 0
			? `${baseLabel} (${missingExternals.length} missing)`
			: baseLabel;

	const envEntries = envNames.map((envName) => {
		const envPaths = pathsByEnv[envName] ?? [];
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

	return {
		countLabel: displayLabel,
		missingCount: missingExternals.length,
		envLabel,
		verboseDetails: {
			recursive,
			paths: externalPaths.map((externalPath) =>
				formatPath(externalPath)
			),
			modules: [
				...externals.map((module) => ({
					name: module.moduleName,
					tags: module.overrideApplied
						? ['external', 'override']
						: ['external'],
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
