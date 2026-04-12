import path from 'path';
import { promises as fsPromises } from 'fs';

import { buildSummarySection } from './report/sections/SummarySection';
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
import {
	formatReportPath,
	isWithinReportRoot,
} from './report/utils/pathDisplay';
import { emitLoggerLines } from './report/utils/loggerOutput';
import type { LoggerLike } from './modelUtils';

export default class AnalysisReporter {
	private readonly logger: LoggerLike;

	private readonly useColor: boolean;

	private readonly packageVersion: string | null;

	constructor({
		logger,
		useColor,
		packageVersion,
	}: {
		logger?: LoggerLike;
		useColor?: boolean;
		packageVersion?: string;
	} = {}) {
		this.logger = logger || console;
		this.useColor =
			typeof useColor === 'boolean' ? useColor : supportsColor();
		this.packageVersion = packageVersion ?? null;
	}

	printConsoleReport(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		const output = this.buildTextReportString(analysis, {
			verbose,
			useColor: this.useColor,
		});
		emitLoggerLines(this.logger, 'info', output.split('\n'), {
			leadingBlank: true,
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
			`\n${this.buildTextReportString(analysis, {
				verbose,
				useColor: false,
			})}\n`
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

	printWarningsAndErrors(
		analysis: ReporterAnalysis,
		{ missingPolicy }: { missingPolicy: 'error' | 'warn' }
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
		{
			verbose = false,
			useColor = false,
		}: { verbose?: boolean; useColor?: boolean } = {}
	): string {
		const view = this.buildReportViewData(analysis, { verbose });
		const palette = {
			...this.getPalette({ useColor }),
			bullet: '- ',
			subBullet: '  -',
			subDash: '    -',
			dot: '-',
		} as PaletteOverride;

		return buildTextReportContent({
			analysis,
			verbose,
			packageVersion: this.packageVersion,
			palette,
			missingPolicy: view.missingPolicy,
			externalsSummary: view.externalsSummary,
			dependencySections: view.dependencySections,
			ignoredModules: view.ignoredModules,
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
