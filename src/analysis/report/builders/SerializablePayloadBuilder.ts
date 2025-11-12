import type {
	AnalysisResult,
	DependencyGraphSnapshot,
	MissingModuleRecord,
	ModuleDependencyEdge,
	ModuleRecord,
} from '../../types';
import {
	getWarningsData,
	getMissingData,
	getErrorsData,
	type WarningData,
	type MissingAlert,
	type ErrorData,
} from '../sections/AlertsSection';
import type { ReporterAnalysis } from '../types';

export interface SerializableAnalysisPayload {
	entry: string | null;
	entryPath: string | null;
	modules: Array<{
		id: string;
		moduleName: string;
		filePath: string | null;
		isExternal: boolean;
	}>;
	externals: Array<{
		id: string;
		moduleName: string;
		filePath: string | null;
	}>;
	missing: Array<
		MissingModuleRecord & {
			severity: MissingAlert['severity'];
			prefix: string;
		}
	>;
	metrics: AnalysisResult['metrics'];
	obfuscation: AnalysisResult['obfuscation'];
	warnings: string[];
	errors: string[];
	success: boolean;
	durationMs: number;
	context: AnalysisResult['context'];
	dependencyGraph?: DependencyGraphSnapshot;
	topologicalOrder?: Array<{
		moduleName: string;
		filePath: string | null;
		isExternal: boolean;
	}>;
	alerts: {
		warnings: WarningData[];
		missing: MissingAlert[];
		errors: ErrorData[];
	};
}

interface BuildSerializablePayloadOptions {
	verbose?: boolean;
}

export function buildSerializablePayload(
	analysis: ReporterAnalysis,
	{ verbose = false }: BuildSerializablePayloadOptions = {}
): SerializableAnalysisPayload {
	const sourceWarnings = analysis.warnings || [];
	const sourceMissing = analysis.missing || [];
	const sourceErrors = analysis.errors || [];
	const warningData = getWarningsData(sourceWarnings);
	const missingData = getMissingData(sourceMissing);
	const errorData = getErrorsData(sourceErrors);

	const payload: SerializableAnalysisPayload = {
		entry: analysis.entryModule?.moduleName ?? null,
		entryPath: analysis.entryModule?.filePath ?? null,
		modules: analysis.modules.map((moduleRecord: ModuleRecord) => ({
			id: moduleRecord.id,
			moduleName: moduleRecord.moduleName,
			filePath: moduleRecord.filePath ?? null,
			isExternal: Boolean(moduleRecord.isExternal),
		})),
		externals: analysis.externals.map((moduleRecord: ModuleRecord) => ({
			id: moduleRecord.id,
			moduleName: moduleRecord.moduleName,
			filePath: moduleRecord.filePath ?? null,
		})),
		missing: missingData.map((item, index) => ({
			...sourceMissing[index],
			severity: item.severity,
			prefix: item.prefix,
		})),
		metrics: analysis.metrics,
		obfuscation: analysis.obfuscation,
		warnings: warningData.map((entry) => entry.message),
		errors: errorData.map((entry) => entry.message),
		success: analysis.success,
		durationMs: analysis.durationMs,
		context: analysis.context,
		alerts: {
			warnings: warningData,
			missing: missingData,
			errors: errorData,
		},
	};

	if (verbose) {
		payload.dependencyGraph = buildDependencyGraphSnapshot(analysis);
		payload.topologicalOrder = analysis.sortedModules.map((moduleRecord: ModuleRecord) => ({
			moduleName: moduleRecord.moduleName,
			filePath: moduleRecord.filePath ?? null,
			isExternal: moduleRecord.isExternal,
		}));
	}

	return payload;
}

function buildDependencyGraphSnapshot(analysis: ReporterAnalysis): DependencyGraphSnapshot {
	const snapshot: DependencyGraphSnapshot = {};
	for (const [moduleId, dependencies] of analysis.dependencyGraph.entries()) {
		snapshot[moduleId] = dependencies.map((dependency: ModuleDependencyEdge) => ({
			id: dependency.id,
			moduleName: dependency.moduleName,
			isExternal: dependency.isExternal,
			isMissing: dependency.isMissing,
			filePath: dependency.filePath,
			overrideApplied: dependency.overrideApplied,
		}));
	}
	return snapshot;
}
