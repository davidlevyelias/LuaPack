import { buildSummarySection } from '../sections/SummarySection';
import {
	buildDependencyTreeSection,
	type DependencyTreeNode,
} from '../sections/DependencyTreeSection';
import {
	buildTopologicalOrderSection,
	type TopologicalItem,
} from '../sections/TopologicalOrderSection';
import {
	buildWarningsSection,
	buildMissingSection,
	buildErrorsSection,
} from '../sections/AlertsSection';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import type { Palette } from '../palette';

type MissingPolicy = 'error' | 'warn' | 'ignore';

export interface PaletteOverride extends Palette {
	bullet: string;
	subBullet: string;
	subDash: string;
	dot: string;
}

export interface TextReportBuilderOptions {
	analysis: ReporterAnalysis;
	verbose: boolean;
	palette: PaletteOverride;
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: DependencyTreeNode[];
	renderDependencySection: (section: DependencyTreeNode) => string[];
	topologicalItems: TopologicalItem[];
}

export function buildTextReport({
	analysis,
	verbose,
	palette,
	missingPolicy,
	externalsSummary,
	dependencySections,
	renderDependencySection,
	topologicalItems,
}: TextReportBuilderOptions): string {
	const lines: string[] = [];

	lines.push(
		...buildSummarySection(analysis, { verbose, externalsSummary }, palette)
	);

	if (verbose) {
		const dependencyLines = buildDependencyTreeSection(dependencySections, {
			palette,
			renderSection: renderDependencySection,
		});
		if (dependencyLines.length > 0) {
			lines.push('');
			lines.push(...dependencyLines);
		}

		const topologicalLines = buildTopologicalOrderSection(
			topologicalItems,
			{
				palette,
				formatItem: (item) => item.name,
			}
		);
		if (topologicalLines.length > 0) {
			lines.push('');
			lines.push(...topologicalLines);
		}
	}

	const warningLines = buildWarningsSection(analysis.warnings, palette);
	if (warningLines.length > 0) {
		lines.push('');
		lines.push(...warningLines);
	}

	const missingLines = buildMissingSection(analysis.missing, {
		palette,
		missingPolicy,
	});
	if (missingLines.length > 0) {
		lines.push('');
		lines.push(...missingLines);
	}

	const errorLines = buildErrorsSection(analysis.errors, palette, {
		excludeMessages: (analysis.missing || []).map((item) => item.message),
	});
	if (errorLines.length > 0) {
		lines.push('');
		lines.push(...errorLines);
	}

	return lines.join('\n');
}
