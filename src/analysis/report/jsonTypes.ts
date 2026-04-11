import type { FallbackMode, MissingPolicy } from '../types';

export type JsonReportCommand = 'analyze' | 'bundle';
export type JsonReportStatus = 'ok' | 'warn' | 'failed';
export type JsonAlertSeverity = 'warn' | 'error';
export type JsonAlertType = 'warning' | 'missing' | 'error';

export interface JsonSummaryPackage {
	name: string;
	root: string;
}

export interface JsonSummary {
	entryModule: string | null;
	entryPath: string | null;
	entryPackage: string | null;
	packages: JsonSummaryPackage[];
	outputPath: string;
	missingPolicy: MissingPolicy;
	fallbackPolicy: FallbackMode;
}

export interface JsonMetrics {
	moduleCount: number;
	externalCount: number;
	missingCount: number;
	moduleSizeSum: number;
	estimatedBundleSize: number;
	bundleSizeBytes: number;
	durationMs: number;
}

export interface JsonModuleSectionItem {
	id: string;
	name: string;
	localModuleId: string;
	filePath: string | null;
}

export interface JsonExternalSectionItem {
	id: string;
	name: string;
	packageName: string;
	localModuleId: string;
	status: 'runtime';
	filePath: string | null;
	ruleApplied: boolean;
}

export interface JsonDependencyGraphItem {
	id: string;
	name: string;
	packageName: string;
	localModuleId: string;
	type: 'module' | 'external';
	status: 'resolved' | 'runtime' | 'ignored' | 'missing';
	filePath: string | null;
	ruleApplied: boolean;
}

export interface JsonAlertBase {
	severity: JsonAlertSeverity;
	type: JsonAlertType;
	message: string;
}

export interface JsonWarningAlert extends JsonAlertBase {
	type: 'warning';
	severity: 'warn';
}

export interface JsonErrorAlert extends JsonAlertBase {
	type: 'error';
	severity: 'error';
}

export interface JsonMissingAlert extends JsonAlertBase {
	type: 'missing';
	requireId: string;
	requiredBy: string | null;
	name: string | null;
	packageName: string;
	localModuleId: string;
	canonicalModuleId: string;
	dependencyType: 'module' | 'external';
	ruleApplied: boolean;
	code?: string;
	filePath?: string | null;
}

export type JsonAlert = JsonWarningAlert | JsonErrorAlert | JsonMissingAlert;

export interface JsonSections {
	modulesByPackage: Record<string, JsonModuleSectionItem[]> | null;
	externals: JsonExternalSectionItem[];
	dependencyGraph: Record<string, JsonDependencyGraphItem[]> | null;
}

export interface SerializableAnalysisPayload {
	type: 'report';
	command: JsonReportCommand;
	status: JsonReportStatus;
	summary: JsonSummary;
	metrics: JsonMetrics;
	alerts: JsonAlert[];
	sections?: JsonSections;
}
