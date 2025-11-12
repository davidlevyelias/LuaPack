/**
 * Core TypeScript domain types describing the analysis pipeline output.
 * These will be adopted incrementally by the JS implementation until the
 * refactor migrates the pipeline and reporter to TypeScript.
 */

export type ModuleId = string;
export type FilePath = string;

export interface WorkflowModulesExternalConfig {
  enabled?: boolean;
  recursive?: boolean;
  paths?: FilePath[];
  env?: string[] | null;
}

export interface WorkflowModulesConfig {
  ignore?: string[];
  ignoreMissing?: boolean;
  external?: WorkflowModulesExternalConfig;
  overrides?: Record<string, { path?: string | null; recursive?: boolean } | undefined>;
}

export interface WorkflowObfuscationRenameConfig {
  enabled?: boolean;
  min?: number;
  max?: number;
}

export interface WorkflowObfuscationConfig {
  tool?: string;
  config?: {
    renameVariables?: boolean | WorkflowObfuscationRenameConfig | null;
    minify?: boolean;
    ascii?: boolean;
  } | null;
}

export interface WorkflowConfig {
  entry: FilePath;
  output: FilePath;
  sourceRoot: FilePath;
  modules?: WorkflowModulesConfig;
  obfuscation?: WorkflowObfuscationConfig | null;
  _analyzeOnly?: boolean;
}

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
  entryPath: FilePath;
  outputPath: FilePath;
  analyzeOnly: boolean;
  ignoredPatterns: string[];
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

export interface ObfuscationRenameConfig {
  enabled: boolean;
  min: number;
  max: number;
}

export interface ObfuscationConfig {
  tool: string;
  rename: ObfuscationRenameConfig;
  minify: boolean;
  ascii: boolean;
}

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
  obfuscation: ObfuscationConfig;
  context: AnalysisContext;
}

export interface AnalysisOptions {
  verbose?: boolean;
}
