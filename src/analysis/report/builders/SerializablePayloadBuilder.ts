import type {
	AnalysisResult,
	MissingModuleRecord,
	ModuleDependencyEdge,
	ModuleRecord,
} from '../../types';
import {
	getWarningsData,
	getMissingData,
	getErrorsData,
} from '../sections/AlertsSection';
import { normalizePathSlashes } from '../utils/format';
import type { ReporterAnalysis } from '../types';

export type JsonReportCommand = 'analyze' | 'bundle';
export type JsonReportStatus = 'ok' | 'warn' | 'failed';
export type JsonAlertSeverity = 'warn' | 'error';
export type JsonAlertType = 'warning' | 'missing' | 'error';

export interface JsonSummary {
	entryModule: string | null;
	entryPath: string | null;
	roots: string[];
	outputPath: string;
	missingPolicy: 'error' | 'warn' | 'ignore';
	fallbackPolicy: 'never' | 'external-only' | 'always';
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

interface BuildSerializablePayloadOptions {
	verbose?: boolean;
}

export function buildSerializablePayload(
	analysis: ReporterAnalysis,
	{ verbose = false }: BuildSerializablePayloadOptions = {}
): SerializableAnalysisPayload {
	const missingPolicy = analysis.context?.missingPolicy ?? 'error';
	const warningAlerts = getWarningsData(
		analysis.warnings || []
	).map<JsonWarningAlert>((entry) => ({
		type: 'warning',
		severity: 'warn',
		message: entry.message,
	}));
	const missingAlerts =
		missingPolicy === 'ignore'
			? []
			: getMissingData(analysis.missing || []).map<JsonMissingAlert>(
					(item, index) => ({
						type: 'missing',
						severity: item.fatal ? 'error' : 'warn',
						message: item.message,
						requireId: item.requireId,
						requiredBy: item.requiredBy,
						name: item.moduleName,
						dependencyType: item.isExternal ? 'external' : 'module',
						ruleApplied: item.overrideApplied,
						code: analysis.missing[index]?.code,
						filePath: normalizeSerializablePath(
							analysis.missing[index]?.filePath
						),
					})
				);
	const missingMessages = new Set(missingAlerts.map((item) => item.message));
	const errorAlerts = getErrorsData(analysis.errors || [])
		.filter((entry) => !missingMessages.has(entry.message))
		.map<JsonErrorAlert>((entry) => ({
			type: 'error',
			severity: 'error',
			message: entry.message,
		}));
	const alerts: JsonAlert[] = [
		...warningAlerts,
		...missingAlerts,
		...errorAlerts,
	];
	const externalSectionItems = buildExternalSectionItems(
		analysis.externals,
		analysis.missing || [],
		{ includeMissing: missingPolicy !== 'ignore' }
	);

	const payload: SerializableAnalysisPayload = {
		type: 'report',
		command: analysis.context?.analyzeOnly ? 'analyze' : 'bundle',
		status: deriveStatus(analysis, alerts),
		summary: {
			entryModule: analysis.entryModule?.moduleName ?? null,
			entryPath: normalizeSerializablePath(
				analysis.context?.entryPath ?? analysis.entryModule?.filePath
			),
			roots: (analysis.context?.roots ?? [])
				.map((rootPath) => normalizeSerializablePath(rootPath))
				.filter((rootPath): rootPath is string => Boolean(rootPath)),
			outputPath: normalizeRequiredSerializablePath(
				analysis.context?.outputPath
			),
			missingPolicy,
			fallbackPolicy: analysis.context?.fallbackPolicy ?? 'external-only',
		},
		metrics: {
			moduleCount: analysis.metrics.moduleCount,
			externalCount: externalSectionItems.length,
			missingCount:
				missingPolicy === 'ignore' ? 0 : analysis.metrics.missingCount,
			moduleSizeSum: analysis.metrics.moduleSizeSum,
			estimatedBundleSize: analysis.metrics.estimatedBundleSize,
			bundleSizeBytes: analysis.metrics.bundleSizeBytes,
			durationMs: roundMetric(analysis.durationMs, 3),
		},
		alerts,
	};

	if (verbose) {
		payload.sections = {
			modules: analysis.modules.map(toModuleSectionItem),
			externals: externalSectionItems,
			dependencyGraph: buildDependencyGraphSnapshot(analysis, {
				includeMissing: missingPolicy !== 'ignore',
			}),
			topologicalOrder: analysis.sortedModules.map(
				(moduleRecord: ModuleRecord) => ({
					name: moduleRecord.moduleName,
					filePath: normalizeSerializablePath(moduleRecord.filePath),
					type: moduleRecord.isExternal ? 'external' : 'module',
				})
			),
		};
	}

	return payload;
}

function deriveStatus(
	analysis: ReporterAnalysis,
	alerts: JsonAlert[]
): JsonReportStatus {
	if (!analysis.success) {
		return 'failed';
	}
	return alerts.some((item) => item.severity === 'warn') ? 'warn' : 'ok';
}

function toModuleSectionItem(
	moduleRecord: ModuleRecord
): JsonModuleSectionItem {
	return {
		id: moduleRecord.id,
		name: moduleRecord.moduleName,
		filePath: normalizeSerializablePath(moduleRecord.filePath),
	};
}

function buildExternalSectionItems(
	externals: ModuleRecord[] | null | undefined,
	missing: MissingModuleRecord[],
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): JsonExternalSectionItem[] {
	const items = new Map<string, JsonExternalSectionItem>();

	for (const moduleRecord of externals || []) {
		const id = moduleRecord.id || moduleRecord.moduleName;
		items.set(id, {
			id,
			name: moduleRecord.moduleName,
			filePath: normalizeSerializablePath(moduleRecord.filePath),
			status: 'resolved',
			ruleApplied: Boolean(moduleRecord.overrideApplied),
		});
	}

	for (const missingRecord of missing) {
		if (!includeMissing) {
			continue;
		}
		if (!missingRecord.isExternal) {
			continue;
		}
		const id = missingRecord.requireId || missingRecord.moduleName;
		if (items.has(id)) {
			continue;
		}
		items.set(id, {
			id,
			name: missingRecord.moduleName,
			filePath: normalizeSerializablePath(missingRecord.filePath),
			status: 'missing',
			ruleApplied: Boolean(missingRecord.overrideApplied),
		});
	}

	return Array.from(items.values());
}

function buildDependencyGraphSnapshot(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): Record<string, JsonDependencyGraphItem[]> {
	const snapshot: Record<string, JsonDependencyGraphItem[]> = {};
	for (const [moduleId, dependencies] of analysis.dependencyGraph.entries()) {
		snapshot[moduleId] = dependencies
			.filter(
				(dependency: ModuleDependencyEdge) =>
					includeMissing || !dependency.isMissing
			)
			.map((dependency: ModuleDependencyEdge) => ({
				id: dependency.id,
				name: dependency.moduleName,
				type: dependency.isExternal ? 'external' : 'module',
				status: dependency.isMissing ? 'missing' : 'resolved',
				filePath: normalizeSerializablePath(dependency.filePath),
				ruleApplied: dependency.overrideApplied,
			}));
	}
	return snapshot;
}

function roundMetric(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

function normalizeSerializablePath(
	targetPath: string | null | undefined
): string | null {
	if (!targetPath) {
		return null;
	}
	return normalizePathSlashes(targetPath);
}

function normalizeRequiredSerializablePath(
	targetPath: string | null | undefined
): string {
	return targetPath ? normalizePathSlashes(targetPath) : '';
}
