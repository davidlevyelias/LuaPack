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

	const baseLabel = `${externals.length}`;
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
					id: module.canonicalModuleId,
					tags: module.overrideApplied
						? ['external', 'override']
						: ['external'],
				})),
				...missingExternals.map((missing) => ({
					id:
						missing.canonicalModuleId ||
						missing.moduleName ||
						missing.requireId,
					tags: ['external', 'missing'],
				})),
			],
		},
	};
}
