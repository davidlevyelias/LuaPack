import type { MissingPolicy } from '../../types';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import type { DependencyTreeNode } from '../sections/DependencyTreeSection';

import { buildSerializablePayload } from './SerializablePayloadBuilder';
import { buildTextReport, type PaletteOverride } from './TextReportBuilder';

export type { PaletteOverride } from './TextReportBuilder';

export interface BuildJsonReportStringOptions {
	verbose?: boolean;
}

export interface BuildTextReportStringOptions {
	analysis: ReporterAnalysis;
	verbose: boolean;
	palette: PaletteOverride;
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: DependencyTreeNode[];
	renderDependencySection: (section: DependencyTreeNode) => string[];
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
	palette,
	missingPolicy,
	externalsSummary,
	dependencySections,
	renderDependencySection,
}: BuildTextReportStringOptions): string {
	return buildTextReport({
		analysis,
		verbose,
		palette,
		missingPolicy,
		externalsSummary,
		dependencySections,
		renderDependencySection,
	});
}
