import { buildSummarySection } from '../sections/SummarySection';
import {
	buildDependencyGraphSection,
	type DependencyGraphPackageSection,
} from '../sections/DependencyGraphSection';
import {
	buildWarningsSection,
	buildMissingSection,
	buildCircularDependencySection,
	buildErrorsSection,
	getCircularDependencyData,
} from '../sections/AlertsSection';
import type { MissingPolicy } from '../../types';
import type { ExternalSummary, ReporterAnalysis } from '../types';
import type { Palette } from '../palette';
import { formatReportPath } from '../utils/pathDisplay';
import { formatModuleLabel } from '../utils/labels';

export interface PaletteOverride extends Palette {
	bullet: string;
	subBullet: string;
	subDash: string;
	dot: string;
}

export interface TextReportBuilderOptions {
	analysis: ReporterAnalysis;
	verbose: boolean;
	packageVersion?: string | null;
	palette: PaletteOverride;
	missingPolicy: MissingPolicy;
	externalsSummary: ExternalSummary;
	dependencySections: DependencyGraphPackageSection[];
	ignoredModules: string[];
}

export function buildTextReport({
	analysis,
	verbose,
	packageVersion,
	palette,
	missingPolicy,
	externalsSummary,
	dependencySections,
	ignoredModules,
}: TextReportBuilderOptions): string {
	const lines: string[] = [];
	const isAnalyze = Boolean(analysis.context?.analyzeOnly);
	const modeLabel = isAnalyze ? 'Analysis' : 'Bundle';
	const versionText = packageVersion ? ` ${packageVersion}` : '';

	lines.push(
		palette.reportHeader(
			`Lua Pack${versionText} - ${modeLabel} Mode`,
			isAnalyze ? 'analysis' : 'bundle'
		)
	);
	lines.push('');

	lines.push(
		...buildSummarySection(analysis, { verbose, externalsSummary }, palette)
	);

	const alertsLines = buildAlertsSection({
		analysis,
		palette,
		missingPolicy,
	});
	if (alertsLines.length > 0) {
		lines.push('');
		lines.push(...alertsLines);
	}

	if (verbose) {
		const packageLines = buildPackagesSection(analysis, palette);
		if (packageLines.length > 0) {
			lines.push('');
			lines.push(...packageLines);
		}

		const externalsLines = buildExternalsSection(
			externalsSummary,
			missingPolicy,
			palette
		);
		if (externalsLines.length > 0) {
			lines.push('');
			lines.push(...externalsLines);
		}

		const ignoredLines = buildIgnoredSection(ignoredModules, palette);
		if (ignoredLines.length > 0) {
			lines.push('');
			lines.push(...ignoredLines);
		}

		const dependencyLines = buildDependencyGraphSection(
			dependencySections,
			palette,
			missingPolicy
		);
		if (dependencyLines.length > 0) {
			lines.push('');
			lines.push(...dependencyLines);
		}
	}

	return lines.join('\n');
}

function buildPackagesSection(
	analysis: ReporterAnalysis,
	palette: PaletteOverride
): string[] {
	const packages = [...(analysis.context?.packages || [])].sort((a, b) =>
		a.name.localeCompare(b.name)
	);
	if (packages.length === 0) {
		return [];
	}

	const moduleCounts = new Map<string, number>();
	for (const moduleRecord of analysis.modules || []) {
		const key = moduleRecord.packageName || 'default';
		moduleCounts.set(key, (moduleCounts.get(key) || 0) + 1);
	}

	const lines: string[] = [];
	lines.push(palette.heading('Packages'));
	lines.push(palette.divider);

	for (const pkg of packages) {
		const rootPath = formatReportPath(pkg.root);
		const moduleCount = moduleCounts.get(pkg.name) || 0;
		lines.push(
			`${palette.bullet} ${palette.packageToken(pkg.name, pkg.name)}`
		);
		lines.push(
			`${palette.subDash} ${palette.key('root:')} ${palette.value(rootPath)}`
		);
		lines.push(
			`${palette.subDash} ${palette.key('modules:')} ${palette.value(String(moduleCount))}`
		);
	}

	return lines;
}

function buildExternalsSection(
	externalsSummary: ExternalSummary,
	missingPolicy: MissingPolicy,
	palette: PaletteOverride
): string[] {
	const modules = [...(externalsSummary.verboseDetails?.modules || [])].sort(
		(a, b) => a.id.localeCompare(b.id)
	);

	if (modules.length === 0) {
		return [];
	}

	const lines: string[] = [];
	lines.push(palette.heading('Externals'));
	lines.push(palette.divider);

	for (const moduleRecord of modules) {
		lines.push(
			`${palette.bullet} ${formatCanonicalModuleId(moduleRecord.id, palette)}`
		);
	}

	return lines;
}

function buildIgnoredSection(
	ignoredModules: string[] | null | undefined,
	palette: PaletteOverride
): string[] {
	if (!ignoredModules || ignoredModules.length === 0) {
		return [];
	}

	const lines: string[] = [];
	lines.push(palette.heading('Ignored'));
	lines.push(palette.divider);
	ignoredModules.forEach((moduleId) => {
		lines.push(
			`${palette.bullet} ${formatCanonicalModuleId(moduleId, palette)}`
		);
	});
	return lines;
}

function buildAlertsSection({
	analysis,
	palette,
	missingPolicy,
}: {
	analysis: ReporterAnalysis;
	palette: PaletteOverride;
	missingPolicy: MissingPolicy;
}): string[] {
	const warningLines = buildWarningsSection(analysis.warnings, palette);
	const missingLines = buildMissingSection(analysis.missing, {
		palette,
		missingPolicy,
	});
	const circularLines = buildCircularDependencySection(analysis.errors, palette);
	const circularMessages = getCircularDependencyData(analysis.errors).map(
		(item) => item.rawMessage
	);
	const errorLines = buildErrorsSection(analysis.errors, palette, {
		excludeMessages: [
			...(analysis.missing || []).map((item) => item.message),
			...circularMessages,
		],
	});

	const formattedGroups = [
		formatAlertGroup(missingLines),
		formatAlertGroup(circularLines),
		formatAlertGroup(errorLines),
		formatAlertGroup(warningLines),
	].filter((group) => group.length > 0);

	if (formattedGroups.length === 0) {
		return [];
	}

	const lines: string[] = [];
	lines.push(palette.heading('Alerts'));
	lines.push(palette.divider);

	for (const group of formattedGroups) {
		if (lines.length > 2) {
			lines.push('');
		}
		lines.push(...group);
	}

	return lines;
}

function formatAlertGroup(lines: string[]): string[] {
	if (lines.length === 0) {
		return [];
	}

	const title = lines[0];
	const body = lines.slice(2);
	if (body.length === 0) {
		return [`[${title}]`];
	}

	return [`[${title}]`, '', ...body];
}

function formatCanonicalModuleId(
	moduleId: string,
	palette: Palette
): string {
	if (!moduleId.startsWith('@') || !moduleId.includes('/')) {
		return palette.value(moduleId);
	}

	const slashIndex = moduleId.indexOf('/');
	const packageName = moduleId.slice(1, slashIndex);
	const suffix = moduleId.slice(slashIndex);
	return `${palette.value('@')}${palette.packageToken(
		packageName,
		packageName
	)}${palette.value(suffix)}`;
}
