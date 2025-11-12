import path from 'path';
import { promises as fsPromises } from 'fs';

import type { AnalysisResult, ModuleRecord } from './types';
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
import { buildSerializablePayload } from './report/builders/SerializablePayloadBuilder';
import {
	buildTextReport as buildTextReportContent,
	type PaletteOverride,
} from './report/builders/TextReportBuilder';
import type { ReporterAnalysis } from './report/types';
import { buildExternalSummary as buildExternalSummaryDetails } from './report/builders/ExternalSummaryBuilder';
import { collectModuleTags, formatModuleLabel } from './report/utils/labels';
import {
	buildDependencyTreeSections as createDependencyTreeSections,
	type ModuleNode,
} from './report/utils/dependencyTree';

interface ReporterLogger {
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
}

export default class AnalysisReporter {
	private readonly logger: ReporterLogger;

	private readonly useColor: boolean;

	constructor({ logger }: { logger?: ReporterLogger } = {}) {
		this.logger = logger || console;
		this.useColor = supportsColor();
	}

	printConsoleReport(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		this.printSummary(analysis, { verbose });

		if (verbose) {
			const ignoreMissing = this.getIgnoreMissing(analysis);
			this.printDependencyTree(analysis, { ignoreMissing });
			this.printTopologicalOrder(analysis, { ignoreMissing });
		}

		this.printWarningsAndErrors(analysis, { verbose });
	}

	printSummary(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		const palette = this.getPalette();
		const externalsSummary = buildExternalSummaryDetails(analysis, {
			formatPath: (value: string | null | undefined) =>
				this.formatPath(value),
		});
		const lines = buildSummarySection(
			analysis as unknown as AnalysisResult,
			{ verbose, externalsSummary },
			palette
		);

		lines.forEach((line) => this.logger.info?.(line));
	}

	printDependencyTree(
		analysis: ReporterAnalysis,
		{ ignoreMissing }: { ignoreMissing: boolean }
	): void {
		const sections = this.buildDependencyTreeSections(analysis);
		const palette = this.getPalette();
		const lines = buildDependencyTreeSection(sections, {
			palette,
			renderSection: (section) =>
				this.buildTreeLines(section, { ignoreMissing }),
		});
		if (lines.length === 0) {
			return;
		}
		this.logger.info?.('');
		lines.forEach((line) => this.logger.info?.(line));
	}

	printTopologicalOrder(
		analysis: ReporterAnalysis,
		{ ignoreMissing }: { ignoreMissing: boolean }
	): void {
		const modules = this.buildTopologicalList(analysis);
		const palette = this.getPalette();
		const lines = buildTopologicalOrderSection(modules, {
			palette,
			formatItem: (item) =>
				formatModuleLabel({
					palette,
					name: item.name,
					tags: item.tags,
					ignoreMissing,
					isEntry: item.isEntry,
					displayTags: false,
				}),
		});
		if (lines.length === 0) {
			return;
		}
		this.logger.info?.('');
		lines.forEach((line) => this.logger.info?.(line));
	}

	printWarningsAndErrors(
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): void {
		const palette = this.getPalette();
		const ignoreMissing = this.getIgnoreMissing(analysis);

		const warningLines = buildWarningsSection(analysis.warnings, palette);
		if (warningLines.length > 0) {
			this.logger.warn?.('');
			warningLines.forEach((line) => this.logger.warn?.(line));
		}

		const missingLines = buildMissingSection(analysis.missing, {
			palette,
			ignoreMissing,
		});
		if (missingLines.length > 0) {
			this.logger.warn?.('');
			missingLines.forEach((line) => this.logger.warn?.(line));
		}

		const errorLines = buildErrorsSection(analysis.errors, palette);
		if (errorLines.length > 0) {
			this.logger.error?.('');
			errorLines.forEach((line) => this.logger.error?.(line));
		}
	}

	async writeReport(
		filePath: string,
		analysis: ReporterAnalysis,
		{ verbose = false }: { verbose?: boolean } = {}
	): Promise<string> {
		const resolvedPath = path.resolve(filePath);
		const ext = path.extname(resolvedPath).toLowerCase();

		if (ext === '.json') {
			const serializable = buildSerializablePayload(analysis, {
				verbose,
			});
			await fsPromises.writeFile(
				resolvedPath,
				JSON.stringify(serializable, null, 2),
				'utf-8'
			);
			return resolvedPath;
		}

		const ignoreMissing = this.getIgnoreMissing(analysis);
		const externalsSummary = buildExternalSummaryDetails(analysis, {
			formatPath: (value: string | null | undefined) =>
				this.formatPath(value),
		});
		const palette = {
			...this.getPalette({ useColor: false }),
			bullet: '- ',
			subBullet: '  -',
			subDash: '    -',
			dot: '-',
		} as PaletteOverride;
		const dependencySections = verbose
			? this.buildDependencyTreeSections(analysis)
			: [];
		const topologicalItems = verbose
			? this.buildTopologicalList(analysis)
			: [];
		const text = buildTextReportContent({
			analysis,
			verbose,
			palette,
			ignoreMissing,
			externalsSummary,
			dependencySections,
			renderDependencySection: (section) =>
				this.buildTreeLines(section as ModuleNode, {
					ignoreMissing,
					useColor: false,
				}),
			topologicalItems,
		});
		await fsPromises.writeFile(resolvedPath, text, 'utf-8');
		return resolvedPath;
	}

	buildDependencyTreeSections(analysis: ReporterAnalysis): ModuleNode[] {
		return createDependencyTreeSections(analysis, {
			formatPath: (value) => this.formatPath(value),
			isWithinRoot: (target, root) => this.isWithinRoot(target, root),
		});
	}

	buildTopologicalList(analysis: ReporterAnalysis): TopologicalItem[] {
		const rootDir = analysis.context?.rootDir ?? null;
		return (analysis.sortedModules || []).map((moduleRecord) => ({
			name: this.getDisplayName(moduleRecord, rootDir),
			tags: collectModuleTags(moduleRecord),
			isEntry:
				Boolean(analysis.entryModule?.filePath) &&
				moduleRecord.filePath === analysis.entryModule?.filePath,
		}));
	}

	buildTreeLines(
		node: ModuleNode,
		{
			ignoreMissing,
			useColor,
		}: { ignoreMissing?: boolean; useColor?: boolean } = {}
	): string[] {
		const lines: string[] = [];
		const palette = this.getPalette({
			useColor: useColor ?? this.useColor,
		});

		const traverse = (
			current: ModuleNode,
			prefix = '',
			isLast = true,
			showPointer = false
		): void => {
			const pointer = showPointer ? (isLast ? '└─ ' : '├─ ') : '';
			const label = formatModuleLabel({
				palette,
				name: current.name,
				tags: current.tags || [],
				ignoreMissing,
				isFolder: current.type === 'folder',
				isEntry: Boolean(current.isEntry),
				displayTags: current.displayTags !== false,
			});
			const prefixText = showPointer ? prefix : '';
			lines.push(`${prefixText}${pointer}${label}`);

			if (!current.children || current.children.length === 0) {
				return;
			}

			const nextPrefix = showPointer
				? `${prefix}${isLast ? '   ' : '│  '}`
				: '';

			current.children.forEach((child, index) => {
				const childIsLast = index === current.children.length - 1;
				traverse(child as ModuleNode, nextPrefix, childIsLast, true);
			});
		};

		traverse(node, '', true, false);
		return lines;
	}

	formatPath(targetPath: string | null | undefined): string {
		if (!targetPath) {
			return 'N/A';
		}
		if (!path.isAbsolute(targetPath)) {
			return targetPath.replace(/\\/g, '/');
		}
		const cwd = process.cwd();
		const relative = path.relative(cwd, targetPath);
		if (!relative || relative === '') {
			return '.';
		}
		return relative.startsWith('..')
			? targetPath.replace(/\\/g, '/')
			: relative.replace(/\\/g, '/');
	}

	getDisplayName(moduleRecord: ModuleRecord, rootDir: string | null): string {
		if (!moduleRecord.filePath) {
			return moduleRecord.moduleName;
		}
		if (rootDir && this.isWithinRoot(moduleRecord.filePath, rootDir)) {
			const relative = path.relative(rootDir, moduleRecord.filePath);
			return relative.replace(/\\/g, '/');
		}
		return this.formatPath(moduleRecord.filePath);
	}

	isWithinRoot(targetPath: string, rootDir: string): boolean {
		if (!targetPath || !rootDir) {
			return false;
		}
		const relative = path.relative(rootDir, targetPath);
		if (relative === '') {
			return true;
		}
		return !relative.startsWith('..') && !path.isAbsolute(relative);
	}

	getIgnoreMissing(analysis: ReporterAnalysis): boolean {
		return Boolean(analysis.context?.ignoreMissing);
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
