import { formatBytes } from '../utils/format';
import type { Palette } from '../palette';
import { formatReportPath } from '../utils/pathDisplay';
import type { ReporterAnalysis, SummarySectionOptions } from '../types';
import { deriveSummaryVerdict } from '../utils/status';

export function buildSummarySection(
	analysis: ReporterAnalysis,
	{ verbose = false, externalsSummary }: SummarySectionOptions,
	palette: Palette
): string[] {
	const lines: string[] = [];
	const missingPolicy = analysis.context?.missingPolicy ?? 'error';
	const entryPath = formatReportPath(analysis.context?.entryPath);
	const outputPath = formatReportPath(analysis.context?.outputPath);
	const moduleCount = analysis.metrics.moduleCount;
	const missingCount = analysis.metrics.missingCount;
	const ignored = analysis.context?.ignoredPatterns ?? [];
	const ignoredCount = ignored.length;
	const effectiveExternalsSummary = externalsSummary;
	const verdict = deriveSummaryVerdict(analysis, missingPolicy);
	const moduleSize = formatBytes(analysis.metrics.moduleSizeSum);
	const bundleSize = formatBytes(
		analysis.metrics.bundleSizeBytes > 0
			? analysis.metrics.bundleSizeBytes
			: analysis.metrics.estimatedBundleSize
	);
	const packages = [...(analysis.context?.packages ?? [])].sort((left, right) =>
		left.name.localeCompare(right.name)
	);

	lines.push(palette.heading('Summary'));
	lines.push(palette.divider);
	lines.push(
		`${palette.key(`${verdict.label}:`)} ${palette.statusValue(
			verdict.value,
			verdict.status
		)}`
	);
	lines.push(`${palette.key('Entry:')} ${palette.value(entryPath)}`);
	lines.push(`${palette.key('Output:')} ${palette.value(outputPath)}`);
	lines.push(
		`${palette.key('Packages:')} ${palette.value(String(packages.length))}`
	);
	if (packages.length === 0) {
		lines.push(`${palette.subBullet} ${palette.muted('none')}`);
	} else {
		packages.forEach((pkg) => {
			lines.push(`${palette.subBullet} ${palette.value(pkg.name)}`);
		});
	}
	lines.push(
		`${palette.key('Modules:')} ${palette.value(String(moduleCount))}`
	);
	lines.push(
		`${palette.bullet} ${palette.key('Missing Action:')} ${palette.value(
			missingPolicy
		)}`
	);
	lines.push(
		`${palette.bullet} ${palette.key('Missing:')} ${palette.value(
			String(missingCount)
		)}`
	);

	lines.push(
		`${palette.bullet} ${palette.key('Externals:')} ${palette.value(
			effectiveExternalsSummary.countLabel
		)}`
	);
	lines.push(
		`${palette.bullet} ${palette.key('Ignored:')} ${palette.value(
			String(ignoredCount)
		)}`
	);

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
