import type { MissingPolicy } from '../../types';
import { buildExternalSummary } from './ExternalSummaryBuilder';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import {
	buildDependencyTreeSections,
	type ModuleNode,
} from '../utils/dependencyTree';

export interface ReportViewData {
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: ModuleNode[];
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
			? buildDependencyTreeSections(analysis, {
					formatPath,
					isWithinRoot,
				})
			: [],
	};
}
