import type { ReporterAnalysis } from '../types';
import type {
	JsonAlert,
	JsonExternalSectionItem,
	JsonReportStatus,
	SerializableAnalysisPayload,
} from '../jsonTypes';
import { buildJsonAlerts } from './JsonAlertBuilder';
import {
	buildJsonExternalSectionItems,
	buildJsonSections,
} from './JsonSectionBuilder';
import { normalizePathSlashes } from '../utils/format';

interface BuildSerializablePayloadOptions {
	verbose?: boolean;
}

export function buildSerializablePayload(
	analysis: ReporterAnalysis,
	{ verbose = false }: BuildSerializablePayloadOptions = {}
): SerializableAnalysisPayload {
	const missingPolicy = analysis.context?.missingPolicy ?? 'error';
	const alerts = buildJsonAlerts(analysis, missingPolicy);
	const externalSectionItems = buildJsonExternalSectionItems(analysis, {
		includeMissing: true,
	});

	const payload: SerializableAnalysisPayload = {
		type: 'report',
		command: analysis.context?.analyzeOnly ? 'analyze' : 'bundle',
		status: deriveStatus(analysis, alerts),
		summary: {
			entryModule: analysis.entryModule?.moduleName ?? null,
			entryPath: normalizeSerializablePath(
				analysis.context?.entryPath ?? analysis.entryModule?.filePath
			),
			entryPackage:
				analysis.entryModule?.packageName ??
				analysis.context?.packages?.find((pkg) => pkg.isEntry)?.name ??
				null,
			packages: (analysis.context?.packages ?? [])
				.map((pkg) => ({
					name: pkg.name,
					root: normalizeRequiredSerializablePath(pkg.root),
				}))
					.filter((pkg) => Boolean(pkg.root))
					.sort((left, right) => left.name.localeCompare(right.name)),
			outputPath: normalizeRequiredSerializablePath(
				analysis.context?.outputPath
			),
			missingPolicy,
			fallbackPolicy: analysis.context?.fallbackPolicy ?? 'external-only',
		},
		metrics: {
			moduleCount: analysis.metrics.moduleCount,
			externalCount: externalSectionItems.length,
			missingCount: analysis.metrics.missingCount,
			moduleSizeSum: analysis.metrics.moduleSizeSum,
			estimatedBundleSize: analysis.metrics.estimatedBundleSize,
			bundleSizeBytes: analysis.metrics.bundleSizeBytes,
			durationMs: roundMetric(analysis.durationMs, 3),
		},
		alerts,
	};

	if (verbose) {
		payload.sections = buildJsonSections(analysis, {
			includeMissing: true,
		});
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
