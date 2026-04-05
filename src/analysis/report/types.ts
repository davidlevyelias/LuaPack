import type { AnalysisResult } from '../types';

export type ReporterWarning = string | { message: string } | null | undefined;
export type ReporterError = { message: string } | Error | null | undefined;

export type ReportCoreAnalysis = Omit<AnalysisResult, 'warnings' | 'errors'>;

export type ReporterAnalysis = ReportCoreAnalysis & {
	warnings: ReporterWarning[];
	errors: ReporterError[];
};

export interface ExternalSummaryModule {
	name: string;
	tags: string[];
}

export interface ExternalSummaryEnvEntry {
	name: string;
	paths: string[];
}

export interface ExternalSummaryEnvDetails {
	hasPaths: boolean;
	totalPaths: number;
	entries: ExternalSummaryEnvEntry[];
}

export interface ExternalSummaryVerboseDetails {
	recursive: boolean;
	paths: string[];
	modules: ExternalSummaryModule[];
	env: ExternalSummaryEnvDetails | null;
}

export interface ExternalSummary {
	countLabel: string;
	missingCount: number;
	envLabel: string;
	verboseDetails?: ExternalSummaryVerboseDetails | null;
}

export interface SummarySectionOptions {
	verbose?: boolean;
	externalsSummary: ExternalSummary;
}
