import { formatBytes } from '../utils/format';
import type { Palette } from '../palette';
import { formatModuleLabel } from '../utils/labels';
import { formatReportPath } from '../utils/pathDisplay';
import type { ReportCoreAnalysis, SummarySectionOptions } from '../types';
import { buildSummaryListSection } from './SummarySectionHelpers';

export function buildSummarySection(
	analysis: ReportCoreAnalysis,
	{ verbose = false, externalsSummary }: SummarySectionOptions,
	palette: Palette
): string[] {
	const lines: string[] = [];
	const missingPolicy = analysis.context?.missingPolicy ?? 'error';
	const rootDir = formatReportPath(analysis.context?.rootDir);
	const entryPath = formatReportPath(analysis.context?.entryPath);
	const outputPath = formatReportPath(analysis.context?.outputPath);
	const moduleCount = analysis.metrics.moduleCount;
	const ignored = analysis.context?.ignoredPatterns ?? [];
	const effectiveExternalsSummary = externalsSummary;
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
	lines.push(`${palette.key('Output:')} ${palette.value(outputPath)}`);
	lines.push(
		`${palette.key('Modules:')} ${palette.value(String(moduleCount))}`
	);

	if (ignored.length > 0) {
		lines.push(`${palette.bullet} ${palette.key('Ignored:')}`);
		ignored.forEach((pattern) => {
			lines.push(`${palette.subDash} ${palette.value(pattern)}`);
		});
	} else {
		lines.push(
			`${palette.bullet} ${palette.key('Ignored:')} ${palette.muted('none')}`
		);
	}

	lines.push(
		`${palette.bullet} ${palette.key('Missing:')} ${palette.value(missingPolicy)}`
	);

	const externalsLabel = palette.externals(
		effectiveExternalsSummary.countLabel,
		{
			missingPolicy,
			hasMissing: effectiveExternalsSummary.missingCount > 0,
		}
	);
	lines.push(
		`${palette.bullet} ${palette.key('Externals:')} ${externalsLabel}`
	);

	if (verbose && effectiveExternalsSummary.verboseDetails) {
		lines.push(
			`${palette.subBullet} ${palette.key('Recursive:')} ${palette.bool(
				effectiveExternalsSummary.verboseDetails.recursive
			)}`
		);

		const pathLines = buildSummaryListSection(
			`${palette.subBullet} ${palette.key('Paths:')}`,
			effectiveExternalsSummary.verboseDetails.paths,
			palette
		);
		lines.push(...pathLines);

		const moduleLines = buildSummaryListSection(
			`${palette.subBullet} ${palette.key('Modules:')}`,
			effectiveExternalsSummary.verboseDetails.modules,
			palette,
			(module) =>
				formatModuleLabel({
					palette,
					name: module.name,
					tags: module.tags,
					missingPolicy,
				})
		);
		lines.push(...moduleLines);

	}

	lines.push(
		`${palette.key('Module Size Sum:')} ${palette.value(moduleSize)}`
	);

	if (!analysis.context?.analyzeOnly) {
		lines.push(
			`${palette.key('Bundle Size:')} ${palette.value(bundleSize)}`
		);
	}

	lines.push(
		`${palette.key('Duration:')} ${palette.value(`${analysis.durationMs.toFixed(2)} ms`)}`
	);

	return lines;
}
