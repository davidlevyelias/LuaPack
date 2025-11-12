import { performance } from 'perf_hooks';
import DependencyAnalyzer from '../DependencyAnalyzer';
import { buildAnalysisContext } from './context/ConfigContextBuilder';
import { buildModuleCollections } from './core/ModuleCollectionBuilder';
import { computeModuleSizeSum } from './core/MetricsCalculator';
import type {
	AnalysisContext,
	AnalysisError,
	AnalysisResult,
	AnalyzerDependencyGraph,
	MissingModuleRecord,
	ModuleRecord,
	ModuleDependencyEdge,
	ModuleId,
	ObfuscationConfig,
	ObfuscationRenameConfig,
	WorkflowConfig,
} from './types';

type PipelineLogger = {
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
};

type DependencyAnalyzerFacade = {
	buildDependencyGraph(entry: string): DependencyAnalyzerResult;
	topologicalSort(graph: AnalyzerDependencyGraph): ModuleRecord[];
};

type DependencyAnalyzerConstructor = new (config: WorkflowConfig) => DependencyAnalyzerFacade;

interface DependencyAnalyzerResult {
	graph: AnalyzerDependencyGraph;
	entryModule: ModuleRecord | null;
	missing: AnalyzerMissingDependency[];
	errors: AnalysisError[];
}

interface AnalyzerMissingDependency {
	requiredBy?: ModuleRecord | null;
	requireId: string;
	record?: ModuleRecord | null;
	error?: (AnalysisError & { code?: unknown }) | null;
	fatal?: boolean;
}

function isModuleRecord(value: unknown): value is ModuleRecord {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const record = value as Record<string, unknown>;
	return typeof record.id === 'string';
}

function normalizeError(error: unknown): AnalysisError {
	if (error instanceof Error) {
		return error;
	}
	return new Error(error ? String(error) : 'Unknown error');
}

export default class AnalysisPipeline {
	private readonly config: WorkflowConfig;
	private readonly logger: PipelineLogger;
	private readonly analyzer: DependencyAnalyzerFacade;

	constructor(config: WorkflowConfig, { logger }: { logger?: PipelineLogger } = {}) {
		this.config = config;
		this.logger = logger || console;
		const AnalyzerCtor = DependencyAnalyzer as unknown as DependencyAnalyzerConstructor;
		this.analyzer = new AnalyzerCtor(config);
	}

	run(): AnalysisResult {
		const start = performance.now();
		const context = buildAnalysisContext(this.config);
		const analysis = this.createEmptyAnalysis(context);

		let graph: AnalyzerDependencyGraph | undefined;
		try {
			const result = this.analyzer.buildDependencyGraph(this.config.entry);
			graph = result.graph;
			analysis.entryModule = isModuleRecord(result.entryModule)
				? result.entryModule
				: null;
			const missingEntries = Array.isArray(result.missing) ? result.missing : [];
			analysis.missing = missingEntries.map((item) => this.formatMissing(item));
			analysis.metrics.missingCount = analysis.missing.length;
			if (Array.isArray(result.errors) && result.errors.length > 0) {
				analysis.errors.push(...result.errors.map(normalizeError));
			}
		} catch (error) {
			analysis.errors.push(normalizeError(error));
			analysis.success = false;
			analysis.durationMs = performance.now() - start;
			return analysis;
		}

		if (!graph || graph.size === 0) {
			analysis.durationMs = performance.now() - start;
			return analysis;
		}

		const collections = buildModuleCollections(graph);
		analysis.moduleById = collections.moduleMap;
		analysis.modules = collections.modules;
		analysis.externals = collections.externals;
		analysis.dependencyGraph = collections.dependencyGraph;

		try {
			const sortedModules = this.analyzer.topologicalSort(graph) ?? [];
			analysis.sortedModules = sortedModules.filter(
				(moduleRecord) => moduleRecord && !moduleRecord.isMissing
			);
			analysis.topologicalOrder = analysis.sortedModules.map(
				(moduleRecord) => moduleRecord.moduleName
			);
		} catch (error) {
			analysis.errors.push(normalizeError(error));
			analysis.success = false;
			analysis.sortedModules = [];
			analysis.topologicalOrder = [];
		}

		analysis.metrics.moduleCount = analysis.modules.length;
		analysis.metrics.externalCount = analysis.externals.length;
		analysis.metrics.moduleSizeSum = computeModuleSizeSum(
			analysis.modules,
			this.logger
		);
		analysis.metrics.estimatedBundleSize = analysis.metrics.moduleSizeSum;
		this.applyMissingWarnings(analysis);

		analysis.durationMs = performance.now() - start;
		analysis.success = analysis.errors.length === 0;

		return analysis;
	}

	private createEmptyAnalysis(context: AnalysisContext): AnalysisResult {
		return {
			entryModule: null,
			modules: [],
			moduleById: new Map<ModuleId, ModuleRecord>(),
			dependencyGraph: new Map<ModuleId, ModuleDependencyEdge[]>(),
			sortedModules: [],
			topologicalOrder: [],
			externals: [],
			missing: [],
			warnings: [],
			errors: [],
			metrics: {
				moduleCount: 0,
				externalCount: 0,
				missingCount: 0,
				moduleSizeSum: 0,
				estimatedBundleSize: 0,
				bundleSizeBytes: 0,
			},
			obfuscation: this.getObfuscationConfig(),
			context,
			success: true,
			durationMs: 0,
		};
	}

	private getObfuscationConfig(): ObfuscationConfig {
		const toolConfig = this.config.obfuscation ?? { tool: 'none', config: {} };
		const rawConfig = toolConfig.config ?? {};
		const rename = this.normalizeRenameConfig(rawConfig.renameVariables);
		return {
			tool: toolConfig.tool ?? 'none',
			rename,
			minify: Boolean(rawConfig.minify),
			ascii: Boolean(rawConfig.ascii),
		};
	}

	private normalizeRenameConfig(renameValue: unknown): ObfuscationRenameConfig {
		const defaults: ObfuscationRenameConfig = { enabled: false, min: 5, max: 5 };
		if (typeof renameValue === 'boolean') {
			return { ...defaults, enabled: renameValue };
		}
		if (renameValue && typeof renameValue === 'object') {
			const value = renameValue as Record<string, unknown>;
			const minCandidate = value.min;
			const maxCandidate = value.max;
			const enabledCandidate = value.enabled;

			const min = Number.isInteger(minCandidate) && (minCandidate as number) > 0
				? (minCandidate as number)
				: defaults.min;
			let max = Number.isInteger(maxCandidate) && (maxCandidate as number) > 0
				? (maxCandidate as number)
				: Math.max(min, defaults.max);
			if (max < min) {
				max = min;
			}
			const enabled = typeof enabledCandidate === 'boolean'
				? enabledCandidate
				: defaults.enabled;
			return { enabled, min, max };
		}
		return { ...defaults };
	}

	private formatMissing(item: AnalyzerMissingDependency): MissingModuleRecord {
		const requiredByRecord = isModuleRecord(item.requiredBy) ? item.requiredBy : null;
		const missingRecord = isModuleRecord(item.record) ? item.record : null;
		const messageSource = item.error ?? (missingRecord?.missingError ?? null);
		const message = messageSource instanceof Error && messageSource.message
			? messageSource.message
			: 'Module was marked missing.';
		const code =
			messageSource && typeof messageSource === 'object' && 'code' in messageSource
				? String((messageSource as { code?: unknown }).code ?? '') || undefined
				: undefined;

		return {
			requiredBy:
				requiredByRecord?.moduleName || requiredByRecord?.id || null,
			requireId: item.requireId,
			moduleName: missingRecord?.moduleName ?? item.requireId,
			filePath: missingRecord?.filePath ?? null,
			isExternal: Boolean(missingRecord?.isExternal),
			overrideApplied: Boolean(missingRecord?.overrideApplied),
			fatal: Boolean(item.fatal),
			message,
			code,
		};
	}

	private applyMissingWarnings(analysis: AnalysisResult): void {
		const warningSet = new Set(analysis.warnings);
		for (const missingEntry of analysis.missing) {
			const isOverrideWarning =
				missingEntry.overrideApplied && !missingEntry.fatal && missingEntry.message;
			if (isOverrideWarning && !warningSet.has(missingEntry.message)) {
				analysis.warnings.push(missingEntry.message);
				warningSet.add(missingEntry.message);
			}
		}
	}
}
