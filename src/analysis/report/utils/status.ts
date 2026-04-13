import type { MissingPolicy } from '../../types';
import type { ReporterAnalysis } from '../types';
import { buildJsonAlerts } from '../builders/JsonAlertBuilder';

export function deriveReportStatus(
	analysis: ReporterAnalysis,
	missingPolicy: MissingPolicy
): 'ok' | 'warn' | 'failed' {
	if (!analysis.success) {
		return 'failed';
	}

	return buildJsonAlerts(analysis, missingPolicy).some(
		(item) => item.severity === 'warn'
	)
		? 'warn'
		: 'ok';
}

export function deriveSummaryVerdict(
	analysis: ReporterAnalysis,
	missingPolicy: MissingPolicy
): {
	label: 'Analysis Result' | 'Bundle Result';
	value: string;
	status: 'ok' | 'warn' | 'failed';
} {
	const status = deriveReportStatus(analysis, missingPolicy);
	const value =
		status === 'failed'
			? 'failed'
			: status === 'warn'
				? 'success with warnings'
				: 'success';

	if (analysis.context?.analyzeOnly) {
		return {
			label: 'Analysis Result',
			value,
			status,
		};
	}

	return {
		label: 'Bundle Result',
		value,
		status,
	};
}