import type { AnalysisResult } from '../types';

export type ReporterWarning = string | { message: string } | null | undefined;
export type ReporterError =
	| ({
			message: string;
			code?: string;
			cycleFiles?: string[];
			cycleModules?: string[];
	  }
			& Partial<Error>)
	| Error
	| null
	| undefined;

export type ReportCoreAnalysis = Omit<AnalysisResult, 'warnings' | 'errors'>;

export type ReporterAnalysis = ReportCoreAnalysis & {
	warnings: ReporterWarning[];
	errors: ReporterError[];
};

export interface ExternalSummaryModule {
	id: string;
	tags: string[];
}

export interface ExternalSummaryVerboseDetails {
	recursive: boolean;
	paths: string[];
	modules: ExternalSummaryModule[];
}

export interface ExternalSummary {
	countLabel: string;
	missingCount: number;
	verboseDetails?: ExternalSummaryVerboseDetails | null;
}

export interface SummarySectionOptions {
	verbose?: boolean;
	externalsSummary: ExternalSummary;
}
