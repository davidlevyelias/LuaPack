import type {
	AnalysisError,
	AnalyzerDependencyGraph,
	AnalyzerGraphNode,
	ModuleRecord,
	WorkflowConfig,
} from '../analysis/types';

export type {
	AnalyzerDependencyGraph,
	AnalyzerGraphNode,
	ModuleRecord,
	WorkflowConfig,
};

export interface MissingDependencyRecord {
	requiredBy: ModuleRecord;
	requireId: string;
	record: ModuleRecord;
	error: AnalysisError | null;
	fatal: boolean;
}

export interface DependencyAnalyzerResult {
	graph: AnalyzerDependencyGraph;
	entryModule: ModuleRecord;
	missing: MissingDependencyRecord[];
	errors: AnalysisError[];
}
