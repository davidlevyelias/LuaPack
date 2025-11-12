import type { MissingModuleRecord } from '../../types';
import type { Palette } from '../palette';
import type { ReporterError, ReporterWarning } from '../types';

export interface WarningData {
	message: string;
}

export interface ErrorData {
	message: string;
}

export interface MissingAlert {
	severity: 'ERROR' | 'WARN';
	message: string;
	prefix: string;
	requireId: string;
	requiredBy: string | null;
	fatal: boolean;
	moduleName: string | null;
	isExternal: boolean;
	overrideApplied: boolean;
}

export interface MissingSectionOptions {
	palette: Palette;
	ignoreMissing?: boolean;
}

function normalizeMessage(value: unknown): string {
	if (value == null) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (
		typeof value === 'object' &&
		value !== null &&
		'message' in value &&
		typeof (value as { message?: unknown }).message === 'string'
	) {
		return (value as { message: string }).message;
	}
	return String(value);
}

export function getWarningsData(
	warnings: ReporterWarning[] | null | undefined
): WarningData[] {
	return (warnings || []).map((entry) => ({ message: normalizeMessage(entry) }));
}

export function buildWarningsSection(
	warnings: ReporterWarning[] | null | undefined,
	palette: Palette
): string[] {
	const warningData = getWarningsData(warnings);
	if (warningData.length === 0) {
		return [];
	}
	const lines: string[] = [];
	lines.push(palette.warningHeader('Warnings'));
	lines.push(palette.warning('--------'));
	warningData.forEach(({ message }) => {
		lines.push(`${palette.warning('-')} ${palette.warning(message)}`);
	});
	return lines;
}

export function getMissingData(
	missing: MissingModuleRecord[] | null | undefined
): MissingAlert[] {
	return (missing || []).map((item) => {
		const fatal = Boolean(item?.fatal);
		const requireId = item?.requireId || 'unknown';
		const severity: MissingAlert['severity'] = fatal ? 'ERROR' : 'WARN';
		const prefix = item?.requiredBy ? `${item.requiredBy} -> ${requireId}` : requireId;
		return {
			severity,
			message: normalizeMessage(item?.message),
			prefix,
			requireId,
			requiredBy: item?.requiredBy || null,
			fatal,
			moduleName: item?.moduleName || null,
			isExternal: Boolean(item?.isExternal),
			overrideApplied: Boolean(item?.overrideApplied),
		};
	});
}

export function buildMissingSection(
	missing: MissingModuleRecord[] | null | undefined,
	{ palette, ignoreMissing = false }: MissingSectionOptions
): string[] {
	const missingData = getMissingData(missing);
	if (missingData.length === 0) {
		return [];
	}
	const headingColor: (value: string) => string = ignoreMissing ? palette.muted : palette.warning;
	const bullet = ignoreMissing ? palette.muted('-') : palette.error('-');
	const lines: string[] = [];
	lines.push(headingColor('Missing Modules'));
	lines.push(headingColor('---------------'));
	missingData.forEach((item) => {
		const colorFn: (value: string) => string = item.fatal && !ignoreMissing ? palette.error : headingColor;
		const destination = item.requireId || item.moduleName || 'unknown';
		const message = ignoreMissing
			? `${item.prefix}: Module not found ignored.`
			: `${item.prefix}: Module not found.`;
		lines.push(`${bullet} ${colorFn(message)}`);
	});
	return lines;
}

export function getErrorsData(
	errors: ReporterError[] | null | undefined
): ErrorData[] {
	const seen = new Set<string>();
	const results: ErrorData[] = [];
	for (const error of errors || []) {
		const message = normalizeMessage(error);
		if (seen.has(message)) {
			continue;
		}
		seen.add(message);
		results.push({ message });
	}
	return results;
}

export function buildErrorsSection(
	errors: ReporterError[] | null | undefined,
	palette: Palette
): string[] {
	const errorsData = getErrorsData(errors);
	if (errorsData.length === 0) {
		return [];
	}
	const lines: string[] = [];
	lines.push(palette.errorHeader('Errors'));
	lines.push(palette.error('------'));
	errorsData.forEach(({ message }) => {
		lines.push(`${palette.error('-')} ${palette.error(message)}`);
	});
	return lines;
}
