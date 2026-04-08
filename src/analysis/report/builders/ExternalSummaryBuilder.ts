import type { ExternalSummary, ReporterAnalysis } from '../types';
import { normalizeExternalSummaryData } from '../utils/externalSummary';

export interface BuildExternalSummaryOptions {
	formatPath: (targetPath: string | null | undefined) => string;
}

export function buildExternalSummary(
	analysis: ReporterAnalysis,
	{ formatPath }: BuildExternalSummaryOptions
): ExternalSummary {
	const { externals, missingExternals, externalPaths, recursive } =
		normalizeExternalSummaryData(analysis);

	const baseLabel = `${externals.length} ${externals.length === 1 ? 'module' : 'modules'}`;
	const displayLabel =
		missingExternals.length > 0
			? `${baseLabel} (${missingExternals.length} missing)`
			: baseLabel;

	return {
		countLabel: displayLabel,
		missingCount: missingExternals.length,
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
		},
	};
}
