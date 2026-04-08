import type { MissingPolicy } from '../../types';
import type { ReporterAnalysis } from '../types';
import {
	getWarningsData,
	getMissingData,
	getErrorsData,
} from '../sections/AlertsSection';
import type {
	JsonAlert,
	JsonErrorAlert,
	JsonMissingAlert,
	JsonWarningAlert,
} from '../jsonTypes';
import { normalizePathSlashes } from '../utils/format';

export function buildJsonAlerts(
	analysis: ReporterAnalysis,
	missingPolicy: MissingPolicy
): JsonAlert[] {
	const warningAlerts = getWarningsData(
		analysis.warnings || []
	).map<JsonWarningAlert>((entry) => ({
		type: 'warning',
		severity: 'warn',
		message: entry.message,
	}));
	const missingData = getMissingData(analysis.missing || []);
	const rawMissingMessages = new Set(missingData.map((item) => item.message));

	const missingAlerts =
		missingPolicy === 'ignore'
			? []
			: missingData.map<JsonMissingAlert>((item) => ({
					type: 'missing',
					severity: item.fatal ? 'error' : 'warn',
					message: normalizeJsonMissingMessage(item),
					requireId: item.requireId,
					requiredBy: item.requiredBy,
					name: item.moduleName,
					dependencyType: item.isExternal ? 'external' : 'module',
					ruleApplied: item.overrideApplied,
					code: item.code,
					filePath: normalizeSerializablePath(item.filePath),
				}));

	const missingMessages = new Set(missingAlerts.map((item) => item.message));
	const errorAlerts = getErrorsData(analysis.errors || [])
		.filter(
			(entry) =>
				!missingMessages.has(entry.message) &&
				!rawMissingMessages.has(entry.message)
		)
		.map<JsonErrorAlert>((entry) => ({
			type: 'error',
			severity: 'error',
			message: entry.message,
		}));

	return [...warningAlerts, ...missingAlerts, ...errorAlerts];
}

function normalizeJsonMissingMessage(item: {
	message: string;
	code?: string;
}): string {
	const message = item.message?.trim();
	if (
		item.code === 'MODULE_NOT_FOUND' &&
		typeof message === 'string' &&
		message.startsWith('Module not found:')
	) {
		return 'Module not found.';
	}
	return message;
}

function normalizeSerializablePath(
	targetPath: string | null | undefined
): string | null {
	if (!targetPath) {
		return null;
	}
	return normalizePathSlashes(targetPath);
}
