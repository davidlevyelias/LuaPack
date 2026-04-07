import type {
	FallbackMode,
	LoadedConfig,
	MissingPolicy,
} from '../config/loader/types';

/**
 * Core TypeScript domain types describing the analysis pipeline output.
 * These will be adopted incrementally by the JS implementation until the
 * refactor migrates the pipeline and reporter to TypeScript.
 */

export type ModuleId = string;
export type FilePath = string;

export type WorkflowConfig = LoadedConfig;

export interface ResolverOverrideInfo {
	path: string | null;
	recursive: boolean | null;
}

export interface EnvironmentEntry {
	name: string;
	paths: FilePath[];
}

export interface EnvironmentInfo {
	hasExplicitConfig: boolean;
	names: string[];
	pathsByEnv: Record<string, FilePath[]>;
	resolvedPaths: FilePath[];
	entries: EnvironmentEntry[];
}

export interface ExternalConfigInfo {
	enabled: boolean;
	recursive: boolean;
	paths: FilePath[];
	env: EnvironmentInfo;
}

export interface AnalysisContext {
	rootDir: FilePath;
	roots: FilePath[];
	entryPath: FilePath;
	outputPath: FilePath;
	analyzeOnly: boolean;
	ignoredPatterns: string[];
	missingPolicy: MissingPolicy;
	fallbackPolicy: FallbackMode;
	ignoreMissing: boolean;
	externals: ExternalConfigInfo;
}

export interface ModuleDependencyEdge {
	id: ModuleId;
	moduleName: string;
	filePath: FilePath | null;
	isExternal: boolean;
	isMissing: boolean;
	overrideApplied: boolean;
}

export interface ModuleRecord {
	id: ModuleId;
	moduleName: string;
	filePath: FilePath | null;
	sourceContent?: string;
	isExternal: boolean;
	overrideApplied: boolean;
	analyzeDependencies: boolean;
	isMissing: boolean;
	isIgnored?: boolean;
	missingError?: Error | null;
	sizeBytes?: number;
}

export interface MissingModuleRecord {
	requireId: string;
	moduleName: string;
	filePath: FilePath | null;
	requiredBy: string | null;
	isExternal: boolean;
	overrideApplied: boolean;
	fatal: boolean;
	message: string;
	code?: string;
}

export interface AnalysisMetrics {
	moduleCount: number;
	externalCount: number;
	missingCount: number;
	moduleSizeSum: number;
	estimatedBundleSize: number;
	bundleSizeBytes: number;
}

export interface AnalyzerGraphNode {
	module: ModuleRecord | null;
	dependencies: ModuleRecord[];
}

export type AnalyzerDependencyGraph = Map<FilePath, AnalyzerGraphNode>;

export interface ModuleCollections {
	moduleMap: Map<ModuleId, ModuleRecord>;
	modules: ModuleRecord[];
	externals: ModuleRecord[];
	dependencyGraph: Map<ModuleId, ModuleDependencyEdge[]>;
}

export type AnalysisWarning = string;

export type AnalysisError = Error;

export interface DependencyGraphSnapshot {
	[moduleId: ModuleId]: ModuleDependencyEdge[];
}

export interface AnalysisResult {
	success: boolean;
	durationMs: number;
	entryModule: ModuleRecord | null;
	modules: ModuleRecord[];
	externals: ModuleRecord[];
	moduleById: Map<ModuleId, ModuleRecord>;
	dependencyGraph: Map<ModuleId, ModuleDependencyEdge[]>;
	sortedModules: ModuleRecord[];
	topologicalOrder: string[];
	missing: MissingModuleRecord[];
	warnings: AnalysisWarning[];
	errors: AnalysisError[];
	metrics: AnalysisMetrics;
	context: AnalysisContext;
}

export interface AnalysisOptions {
	verbose?: boolean;
}
