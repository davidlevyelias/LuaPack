import { formatBytes } from '../utils/format';
import type { AnalysisResult } from '../../types';
import type { Palette } from '../palette';
import { formatModuleLabel } from '../utils/labels';
import type { ExternalSummaryEnvDetails, SummarySectionOptions } from '../types';

export function buildSummarySection(
	analysis: AnalysisResult,
	{ verbose = false, externalsSummary }: SummarySectionOptions,
	palette: Palette
): string[] {
	const lines: string[] = [];
	const ignoreMissing = Boolean(analysis.context?.ignoreMissing);
	const rootDir = formatPath(analysis.context?.rootDir);
	const entryPath = formatPath(analysis.context?.entryPath);
	const moduleCount = analysis.metrics.moduleCount;
	const ignored = analysis.context?.ignoredPatterns ?? [];
	const effectiveExternalsSummary = externalsSummary;
	const renameInfo = analysis.obfuscation?.rename ?? { enabled: false, min: 5, max: 5 };
	const moduleSize = formatBytes(analysis.metrics.moduleSizeSum);
	const bundleSize = formatBytes(
		analysis.metrics.bundleSizeBytes > 0
			? analysis.metrics.bundleSizeBytes
			: analysis.metrics.estimatedBundleSize
	);

	lines.push(palette.heading('Analysis Summary'));
	lines.push(palette.divider);
	lines.push(`${palette.key('Root Dir:')} ${palette.value(rootDir)}`);
	lines.push(`${palette.key('Entry:')} ${palette.value(entryPath)}`);
	lines.push(`${palette.key('Modules:')} ${palette.value(String(moduleCount))}`);

	if (ignored.length > 0) {
		lines.push(`${palette.bullet} ${palette.key('Ignored:')}`);
		ignored.forEach((pattern) => {
			lines.push(`${palette.subDash} ${palette.value(pattern)}`);
		});
	} else {
		lines.push(`${palette.bullet} ${palette.key('Ignored:')} ${palette.muted('none')}`);
	}

	lines.push(
		`${palette.bullet} ${palette.key('Ignore Missing:')} ${palette.bool(ignoreMissing)}`
	);

	const externalsLabel = palette.externals(effectiveExternalsSummary.countLabel, {
		ignoreMissing,
		hasMissing: effectiveExternalsSummary.missingCount > 0,
	});
	lines.push(`${palette.bullet} ${palette.key('Externals:')} ${externalsLabel}`);

	if (verbose && effectiveExternalsSummary.verboseDetails) {
		lines.push(
			`${palette.subBullet} ${palette.key('Recursive:')} ${palette.bool(
				effectiveExternalsSummary.verboseDetails.recursive
			)}`
		);

		const pathLines = buildListSection(
			`${palette.subBullet} ${palette.key('Paths:')}`,
			effectiveExternalsSummary.verboseDetails.paths,
			palette
		);
		lines.push(...pathLines);

		const moduleLines = buildListSection(
			`${palette.subBullet} ${palette.key('Modules:')}`,
			effectiveExternalsSummary.verboseDetails.modules,
			palette,
			(module) =>
				formatModuleLabel({
					palette,
					name: module.name,
					tags: module.tags,
					ignoreMissing,
				})
		);
		lines.push(...moduleLines);

		const envLines = buildEnvSection(effectiveExternalsSummary.verboseDetails.env, palette);
		lines.push(...envLines);
	}

	lines.push(palette.key('Obfuscation:'));
	const renameMin = typeof renameInfo.min === 'number' ? renameInfo.min : 5;
	const renameMax = typeof renameInfo.max === 'number' ? renameInfo.max : 5;
	lines.push(
		`  ${palette.dot} Variable Rename: ${palette.bool(renameInfo.enabled)} ${palette.muted(
			`(min=${renameMin}, max=${renameMax})`
		)}`
	);
	lines.push(`  ${palette.dot} Minify         : ${palette.bool(!!analysis.obfuscation?.minify)}`);
	lines.push(`  ${palette.dot} ASCII          : ${palette.bool(!!analysis.obfuscation?.ascii)}`);
	lines.push(`${palette.key('Module Size Sum:')} ${palette.value(moduleSize)}`);

	if (!analysis.context?.analyzeOnly) {
		lines.push(`${palette.key('Bundle Size:')} ${palette.value(bundleSize)}`);
	}

	lines.push(
		`${palette.key('Duration:')} ${palette.value(`${analysis.durationMs.toFixed(2)} ms`)}`
	);

	return lines;
}

function buildListSection<T>(
	headerLine: string,
	items: T[] | undefined,
	palette: Palette,
	formatItem: (item: T) => string = (item) => palette.value(String(item))
): string[] {
	if (!items || items.length === 0) {
		return [headerLine, `${palette.subDash} ${palette.muted('none')}`];
	}
	const result = [headerLine];
	items.forEach((item) => {
		result.push(`${palette.subDash} ${formatItem(item)}`);
	});
	return result;
}

function buildEnvSection(
	envVerbose: ExternalSummaryEnvDetails | null | undefined,
	palette: Palette
): string[] {
	if (!envVerbose) {
		return [];
	}

	const total = Number.isFinite(envVerbose.totalPaths) ? envVerbose.totalPaths : 0;
	const header = `${palette.subBullet} ${palette.key('Env Paths:')} ${palette.muted(`(${total} ${
		total === 1 ? 'path' : 'paths'
	})`)}`;

	if (!envVerbose.entries || envVerbose.entries.length === 0) {
		return [header, `${palette.subDash} ${palette.muted('none')}`];
	}

	const lines = [header];
	envVerbose.entries.forEach((entry) => {
		const hasPaths = Array.isArray(entry.paths) && entry.paths.length > 0;
		const nameLabel = palette.envName(entry.name, hasPaths);
		if (!hasPaths) {
			lines.push(`${palette.subDash} ${nameLabel} ${palette.muted('(none)')}`);
			return;
		}
		lines.push(`${palette.subDash} ${nameLabel}`);
		entry.paths.forEach((envPath) => {
			lines.push(`${palette.subDash}   ${palette.value(envPath)}`);
		});
	});
	return lines;
}

function formatPath(targetPath: string | null | undefined): string {
	if (!targetPath) {
		return 'N/A';
	}
	return typeof targetPath === 'string' ? targetPath.replace(/\\/g, '/') : 'N/A';
}
