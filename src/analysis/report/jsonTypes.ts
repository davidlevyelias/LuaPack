import type { FallbackMode, MissingPolicy } from '../types';

export type JsonReportCommand = 'analyze' | 'bundle';
export type JsonReportStatus = 'ok' | 'warn' | 'failed';
export type JsonAlertSeverity = 'warn' | 'error';
export type JsonAlertType = 'warning' | 'missing' | 'error';

export interface JsonSummary {
	entryModule: string | null;
	entryPath: string | null;
	roots: string[];
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
	filePath: string | null;
}

export interface JsonExternalSectionItem {
	id: string;
	name: string;
	filePath: string | null;
	status: 'resolved' | 'missing';
	ruleApplied: boolean;
}

export interface JsonTopologicalItem {
	name: string;
	filePath: string | null;
	type: 'module' | 'external';
}

export interface JsonDependencyGraphItem {
	id: string;
	name: string;
	type: 'module' | 'external';
	status: 'resolved' | 'missing';
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
	dependencyType: 'module' | 'external';
	ruleApplied: boolean;
	code?: string;
	filePath?: string | null;
}

export type JsonAlert = JsonWarningAlert | JsonErrorAlert | JsonMissingAlert;

export interface JsonSections {
	modules: JsonModuleSectionItem[] | null;
	externals: JsonExternalSectionItem[];
	dependencyGraph: Record<string, JsonDependencyGraphItem[]> | null;
	topologicalOrder: JsonTopologicalItem[] | null;
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
