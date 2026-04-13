import type { ReporterAnalysis } from '../types';

type StringArray = string[];

export interface NormalizedExternalSummaryData {
	externals: ReporterAnalysis['externals'];
	missingExternals: NonNullable<ReporterAnalysis['missing']>;
	externalPaths: string[];
	recursive: boolean;
}

export function normalizeExternalSummaryData(
	analysis: ReporterAnalysis
): NormalizedExternalSummaryData {
	const externals = Array.isArray(analysis.externals)
		? analysis.externals
		: [];
	const missingExternals = (analysis.missing || []).filter(
		(missing) => missing.isExternal
	);
	const externalsContext = analysis.context?.externals;

	return {
		externals,
		missingExternals,
		externalPaths: toStringArray(externalsContext?.paths),
		recursive:
			typeof externalsContext?.recursive === 'boolean'
				? externalsContext.recursive
				: true,
	};
}

function toStringArray(value: unknown): StringArray {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === 'string');
}
