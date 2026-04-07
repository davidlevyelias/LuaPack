import path from 'path';
import { promises as fsPromises } from 'fs';

import type { MissingPolicy } from './types';
import { buildSummarySection } from './report/sections/SummarySection';
import { buildDependencyTreeSection } from './report/sections/DependencyTreeSection';
import {
	buildTopologicalOrderSection,
	type TopologicalItem,
} from './report/sections/TopologicalOrderSection';
import {
	buildWarningsSection,
	buildMissingSection,
	buildErrorsSection,
} from './report/sections/AlertsSection';
import { createPalette, type Palette } from './report/palette';
import {
	buildJsonReportString as buildJsonReportContent,
	buildTextReportString as buildTextReportContent,
	type PaletteOverride,
} from './report/builders/ReportContentBuilder';
import type { ReporterAnalysis } from './report/types';
import { buildReportViewData } from './report/builders/ReportViewBuilder';
import { formatModuleLabel } from './report/utils/labels';
import type { ModuleNode } from './report/utils/dependencyTree';
import {
	formatReportPath,
	isWithinReportRoot,
} from './report/utils/pathDisplay';
import { buildTreeLines } from './report/utils/treeLineBuilder';
import { emitLoggerLines } from './report/utils/loggerOutput';
import type { LoggerLike } from './modelUtils';

export default class AnalysisReporter {
	private readonly logger: LoggerLike;

	private readonly useColor: boolean;

	constructor({
		logger,
		useColor,
	}: { logger?: LoggerLike; useColor?: boolean } = {}) {
		this.logger = logger || console;
		this.useColor =
			typeof useColor === 'boolean' ? useColor : supportsColor();
	}

	printConsoleReport(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		const view = this.buildReportViewData(analysis, { verbose });
		this.printSummary(analysis, {
			verbose,
			externalsSummary: view.externalsSummary,
		});

		if (verbose) {
			this.printDependencyTree(view.dependencySections, {
				missingPolicy: view.missingPolicy,
			});
			this.printTopologicalOrder(view.topologicalItems, {
				missingPolicy: view.missingPolicy,
			});
		}

		this.printWarningsAndErrors(analysis, {
			missingPolicy: view.missingPolicy,
		});
	}

	printJsonReport(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		process.stdout.write(
			`${this.buildJsonReportString(analysis, { verbose })}\n`
		);
	}

	printTextReport(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		process.stdout.write(
			`${this.buildTextReportString(analysis, { verbose })}\n`
		);
	}

	printSummary(
		analysis: ReporterAnalysis,
		{
			verbose = false,
			externalsSummary,
		}: {
			verbose?: boolean;
			externalsSummary?: ReturnType<
				AnalysisReporter['buildReportViewData']
			>['externalsSummary'];
		} = {}
	): void {
		const palette = this.getPalette();
		const lines = buildSummarySection(
			analysis,
			{
				verbose,
				externalsSummary:
					externalsSummary ??
					this.buildReportViewData(analysis, { verbose: false })
						.externalsSummary,
			},
			palette
		);

		emitLoggerLines(this.logger, 'info', lines);
	}

	printDependencyTree(
		sections: ModuleNode[],
		{ missingPolicy }: { missingPolicy: MissingPolicy }
	): void {
		const palette = this.getPalette();
		const lines = buildDependencyTreeSection(sections, {
			palette,
			renderSection: (section) =>
				buildTreeLines(section, { palette, missingPolicy }),
		});
		emitLoggerLines(this.logger, 'info', lines, { leadingBlank: true });
	}

	printTopologicalOrder(
		modules: TopologicalItem[],
		{ missingPolicy }: { missingPolicy: MissingPolicy }
	): void {
		const palette = this.getPalette();
		const lines = buildTopologicalOrderSection(modules, {
			palette,
			formatItem: (item) =>
				formatModuleLabel({
					palette,
					name: item.name,
					tags: item.tags,
					missingPolicy,
					isEntry: item.isEntry,
					displayTags: false,
				}),
		});
		emitLoggerLines(this.logger, 'info', lines, { leadingBlank: true });
	}

	printWarningsAndErrors(
		analysis: ReporterAnalysis,
		{ missingPolicy }: { missingPolicy: MissingPolicy }
	): void {
		const palette = this.getPalette();

		const warningLines = buildWarningsSection(analysis.warnings, palette);
		emitLoggerLines(this.logger, 'warn', warningLines, {
			leadingBlank: true,
		});

		const missingLines = buildMissingSection(analysis.missing, {
			palette,
			missingPolicy,
		});
		emitLoggerLines(this.logger, 'warn', missingLines, {
			leadingBlank: true,
		});

		const errorLines = buildErrorsSection(analysis.errors, palette, {
			excludeMessages: (analysis.missing || []).map(
				(item) => item.message
			),
		});
		emitLoggerLines(this.logger, 'error', errorLines, {
			leadingBlank: true,
		});
	}

	async writeReport(
		filePath: string,
		analysis: ReporterAnalysis,
		{
			verbose = false,
			format,
		}: { verbose?: boolean; format?: 'text' | 'json' } = {}
	): Promise<string> {
		const resolvedPath = path.resolve(filePath);
		const effectiveFormat = format || 'text';

		if (effectiveFormat === 'json') {
			await fsPromises.writeFile(
				resolvedPath,
				this.buildJsonReportString(analysis, { verbose }),
				'utf-8'
			);
			return resolvedPath;
		}

		const text = this.buildTextReportString(analysis, { verbose });
		await fsPromises.writeFile(resolvedPath, text, 'utf-8');
		return resolvedPath;
	}

	buildJsonReportString(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): string {
		return buildJsonReportContent(analysis, { verbose });
	}

	buildTextReportString(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): string {
		const view = this.buildReportViewData(analysis, { verbose });
		const palette = {
			...this.getPalette({ useColor: false }),
			bullet: '- ',
			subBullet: '  -',
			subDash: '    -',
			dot: '-',
		} as PaletteOverride;

		return buildTextReportContent({
			analysis,
			verbose,
			palette,
			missingPolicy: view.missingPolicy,
			externalsSummary: view.externalsSummary,
			dependencySections: view.dependencySections,
			renderDependencySection: (section: ModuleNode) =>
				buildTreeLines(section, {
					palette,
					missingPolicy: view.missingPolicy,
				}),
			topologicalItems: view.topologicalItems,
		});
	}

	buildReportViewData(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	) {
		return buildReportViewData(analysis, {
			verbose,
			formatPath: (value) => formatReportPath(value),
			isWithinRoot: (target, root) => isWithinReportRoot(target, root),
		});
	}

	getPalette({
		useColor = this.useColor,
	}: { useColor?: boolean } = {}): Palette {
		return createPalette({ useColor });
	}
}

function supportsColor(): boolean {
	return Boolean(process.stdout && process.stdout.isTTY);
}
