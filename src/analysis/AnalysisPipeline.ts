import { performance } from 'perf_hooks';
import DependencyAnalyzer from '../dependency';
import { buildAnalysisContext } from './context/ConfigContextBuilder';
import { buildModuleCollections } from './core/ModuleCollectionBuilder';
import { computeModuleSizeSum } from './core/MetricsCalculator';
import { isModuleRecord, type LoggerLike } from './modelUtils';
import type {
	AnalysisContext,
	AnalysisError,
	AnalysisResult,
	AnalyzerDependencyGraph,
	MissingModuleRecord,
	ModuleRecord,
	ModuleDependencyEdge,
	ModuleId,
	WorkflowConfig,
} from './types';

interface AnalyzerMissingDependency {
	requiredBy?: ModuleRecord | null;
	requireId: string;
	record?: ModuleRecord | null;
	error?: (AnalysisError & { code?: unknown }) | null;
	fatal?: boolean;
}

function normalizeError(error: unknown): AnalysisError {
	if (error instanceof Error) {
		return error;
	}
	return new Error(error ? String(error) : 'Unknown error');
}

export default class AnalysisPipeline {
	private readonly config: WorkflowConfig;
	private readonly logger: LoggerLike;
	private readonly analyzer: DependencyAnalyzer;

	constructor(
		config: WorkflowConfig,
		{ logger }: { logger?: LoggerLike } = {}
	) {
		this.config = config;
		this.logger = logger || console;
		this.analyzer = new DependencyAnalyzer(config);
	}

	run(): AnalysisResult {
		const start = performance.now();
		const context = buildAnalysisContext(this.config);
		const analysis = this.createEmptyAnalysis(context);

		let graph: AnalyzerDependencyGraph | undefined;
		try {
			const result = this.analyzer.buildDependencyGraph(
				this.config.entry
			);
			graph = result.graph;
			analysis.entryModule = isModuleRecord(result.entryModule)
				? result.entryModule
				: null;
			const missingEntries = Array.isArray(result.missing)
				? result.missing
				: [];
			analysis.missing = missingEntries.map((item) =>
				this.formatMissing(item)
			);
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
		analysis.success =
			analysis.errors.length === 0 &&
			!analysis.missing.some((missingEntry) => missingEntry.fatal);

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
			context,
			success: true,
			durationMs: 0,
		};
	}

	private formatMissing(
		item: AnalyzerMissingDependency
	): MissingModuleRecord {
		const requiredByRecord = isModuleRecord(item.requiredBy)
			? item.requiredBy
			: null;
		const missingRecord = isModuleRecord(item.record) ? item.record : null;
		const messageSource = item.error ?? missingRecord?.missingError ?? null;
		const message =
			messageSource instanceof Error && messageSource.message
				? messageSource.message
				: 'Module not found.';
		const code =
			messageSource &&
			typeof messageSource === 'object' &&
			'code' in messageSource
				? String((messageSource as { code?: unknown }).code ?? '') ||
					undefined
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
				missingEntry.overrideApplied &&
				!missingEntry.fatal &&
				missingEntry.message;
			if (isOverrideWarning && !warningSet.has(missingEntry.message)) {
				analysis.warnings.push(missingEntry.message);
				warningSet.add(missingEntry.message);
			}
		}
	}
}
