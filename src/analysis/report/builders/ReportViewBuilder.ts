import type { MissingPolicy } from '../../types';
import { buildExternalSummary } from './ExternalSummaryBuilder';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import {
	buildDependencyGraphSections,
	type DependencyGraphPackageSection,
} from '../sections/DependencyGraphSection';

export interface ReportViewData {
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: DependencyGraphPackageSection[];
	ignoredModules: string[];
}

export interface BuildReportViewOptions {
	verbose?: boolean;
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

export function buildReportViewData(
	analysis: ReporterAnalysis,
	{ verbose = false, formatPath, isWithinRoot }: BuildReportViewOptions
): ReportViewData {
	const missingPolicy = analysis.context?.missingPolicy ?? 'error';
	const externalsSummary = buildExternalSummary(analysis, {
		formatPath,
	});

	return {
		missingPolicy,
		externalsSummary,
		dependencySections: verbose
			? buildDependencyGraphSections(analysis)
			: [],
		ignoredModules: verbose
			? Array.from(
					new Set(
						Array.from(analysis.dependencyGraph.values())
							.flat()
							.filter((dependency) => dependency.isIgnored)
							.map((dependency) => dependency.id)
					)
				).sort((left, right) => left.localeCompare(right))
			: [],
	};
}
