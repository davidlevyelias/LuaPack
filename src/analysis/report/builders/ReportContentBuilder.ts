import type { MissingPolicy } from '../../types';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import type { DependencyGraphPackageSection } from '../sections/DependencyGraphSection';

import { buildSerializablePayload } from './SerializablePayloadBuilder';
import { buildTextReport, type PaletteOverride } from './TextReportBuilder';

export type { PaletteOverride } from './TextReportBuilder';

export interface BuildJsonReportStringOptions {
	verbose?: boolean;
}

export interface BuildTextReportStringOptions {
	analysis: ReporterAnalysis;
	verbose: boolean;
	packageVersion?: string | null;
	palette: PaletteOverride;
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: DependencyGraphPackageSection[];
	ignoredModules: string[];
}

export function buildJsonReportString(
	analysis: ReporterAnalysis,
	{ verbose = false }: BuildJsonReportStringOptions = {}
): string {
	return JSON.stringify(
		buildSerializablePayload(analysis, { verbose }),
		null,
		2
	);
}

export function buildTextReportString({
	analysis,
	verbose,
	packageVersion,
	palette,
	missingPolicy,
	externalsSummary,
	dependencySections,
	ignoredModules,
}: BuildTextReportStringOptions): string {
	return buildTextReport({
		analysis,
		verbose,
		packageVersion,
		palette,
		missingPolicy,
		externalsSummary,
		dependencySections,
		ignoredModules,
	});
}
