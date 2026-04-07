import type { MissingPolicy } from '../../types';
import { buildExternalSummary } from './ExternalSummaryBuilder';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import {
	buildDependencyTreeSections,
	type ModuleNode,
} from '../utils/dependencyTree';
import { collectModuleTags } from '../utils/labels';
import { getModuleDisplayName } from '../utils/pathDisplay';
import type { TopologicalItem } from '../sections/TopologicalOrderSection';

export interface ReportViewData {
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: ModuleNode[];
	topologicalItems: TopologicalItem[];
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
		topologicalItems: verbose ? buildTopologicalItems(analysis) : [],
	};
}

function buildTopologicalItems(analysis: ReporterAnalysis): TopologicalItem[] {
	const rootDir = analysis.context?.rootDir ?? null;
	return (analysis.sortedModules || []).map((moduleRecord) => ({
		name: getModuleDisplayName(moduleRecord, rootDir),
		tags: collectModuleTags(moduleRecord),
		isEntry:
			Boolean(analysis.entryModule?.filePath) &&
			moduleRecord.filePath === analysis.entryModule?.filePath,
	}));
}
