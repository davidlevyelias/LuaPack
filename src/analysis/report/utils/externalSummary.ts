import type { ReporterAnalysis } from '../types';

type StringArray = string[];

export interface NormalizedExternalSummaryData {
	externals: ReporterAnalysis['externals'];
	missingExternals: NonNullable<ReporterAnalysis['missing']>;
	externalPaths: string[];
	recursive: boolean;
	envNames: string[];
	resolvedEnvPaths: string[];
	pathsByEnv: Record<string, string[]>;
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
	const envContext = externalsContext?.env;

	return {
		externals,
		missingExternals,
		externalPaths: toStringArray(externalsContext?.paths),
		recursive:
			typeof externalsContext?.recursive === 'boolean'
				? externalsContext.recursive
				: true,
		envNames: toStringArray(envContext?.names),
		resolvedEnvPaths: toStringArray(envContext?.resolvedPaths),
		pathsByEnv: normalizePathsByEnv(envContext?.pathsByEnv),
	};
}

function normalizePathsByEnv(pathsByEnv: unknown): Record<string, string[]> {
	if (!pathsByEnv || typeof pathsByEnv !== 'object') {
		return {};
	}

	return Object.fromEntries(
		Object.entries(pathsByEnv).map(([envName, value]) => [
			envName,
			toStringArray(value),
		])
	);
}

function toStringArray(value: unknown): StringArray {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === 'string');
}
