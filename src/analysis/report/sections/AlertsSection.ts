import type { MissingModuleRecord, MissingPolicy } from '../../types';
import type { Palette } from '../palette';
import type { ReporterError, ReporterWarning } from '../types';

export interface WarningData {
	message: string;
}

export interface ErrorData {
	message: string;
	code?: string;
}

export interface CircularDependencyData {
	rawMessage: string;
	message: string;
}

const CIRCULAR_DEPENDENCY_PREFIX = 'Circular dependency detected:';

export interface MissingAlert {
	severity: 'ERROR' | 'WARN';
	message: string;
	prefix: string;
	requireId: string;
	requiredBy: string | null;
	fatal: boolean;
	moduleName: string | null;
	isExternal: boolean;
	ruleApplied: boolean;
	overrideApplied: boolean;
	code?: string;
	filePath?: string | null;
	packageName: string;
	localModuleId: string;
	canonicalModuleId: string;
}

export interface MissingSectionOptions {
	palette: Palette;
	missingPolicy?: MissingPolicy;
}

function formatMissingRequester(item: MissingAlert): string {
	const packageName = item.packageName || 'default';
	const requiredBy = item.requiredBy || 'unknown';
	let localModuleId = requiredBy;

	if (requiredBy === packageName) {
		localModuleId = 'init';
	} else if (
		packageName !== 'default' &&
		requiredBy.startsWith(`${packageName}.`)
	) {
		localModuleId = requiredBy.slice(packageName.length + 1);
	}

	return `@${packageName}/${localModuleId}`;
}

function formatMissingMessage(message: string): string {
	if (!message) {
		return 'Module not found';
	}

	if (/^Module not found\b/i.test(message)) {
		return 'Module not found';
	}

	return message;
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

function getErrorCode(value: unknown): string | undefined {
	if (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		typeof (value as { code?: unknown }).code === 'string'
	) {
		return (value as { code: string }).code;
	}
	return undefined;
}

function isCircularDependencyError(value: unknown): boolean {
	return (
		getErrorCode(value) === 'CIRCULAR_DEPENDENCY' ||
		new RegExp(`^${CIRCULAR_DEPENDENCY_PREFIX}`, 'i').test(
			normalizeMessage(value)
		)
	);
}

function normalizeCircularDependencyMessage(message: string): string {
	if (!message) {
		return message;
	}
	return message.replace(/^Circular dependency detected:\s*/i, '').trim();
}

export function getWarningsData(
	warnings: ReporterWarning[] | null | undefined
): WarningData[] {
	return (warnings || []).map((entry) => ({
		message: normalizeMessage(entry),
	}));
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
		const prefix = item?.requiredBy
			? `${item.requiredBy} -> ${requireId}`
			: requireId;
		return {
			severity,
			message: normalizeMessage(item?.message),
			prefix,
			requireId,
			requiredBy: item?.requiredBy || null,
			fatal,
			moduleName: item?.moduleName || null,
			isExternal: Boolean(item?.isExternal),
			ruleApplied: Boolean(item?.ruleApplied),
			overrideApplied: Boolean(item?.overrideApplied),
			code: item?.code,
			filePath: item?.filePath ?? null,
			packageName: item?.packageName || 'default',
			localModuleId: item?.localModuleId || requireId,
			canonicalModuleId: item?.canonicalModuleId || requireId,
		};
	});
}

export function buildMissingSection(
	missing: MissingModuleRecord[] | null | undefined,
	{ palette, missingPolicy = 'error' }: MissingSectionOptions
): string[] {
	const missingData = getMissingData(missing);
	if (missingData.length === 0) {
		return [];
	}
	const headingColor: (value: string) => string =
		missingData.some((item) => item.fatal)
				? palette.error
				: palette.warning;
	const lines: string[] = [];
	lines.push(headingColor('Missing Modules'));
	lines.push(headingColor('---------------'));
	missingData.forEach((item) => {
		const colorFn: (value: string) => string =
			item.fatal
					? palette.error
					: palette.warning;
		const bullet = colorFn('-');
		const requesterLabel = formatMissingRequester(item);
		const displayText = `${requesterLabel} -> ${item.requireId}`;
		const fullText = `${displayText}: ${formatMissingMessage(item.message)}`;
		lines.push(`${bullet} ${colorFn(fullText)}`);
	});
	return lines;
}

export function getErrorsData(
	errors: ReporterError[] | null | undefined,
	{ excludeMessages = [] }: { excludeMessages?: string[] } = {}
): ErrorData[] {
	const seen = new Set<string>();
	const excluded = new Set(excludeMessages);
	const results: ErrorData[] = [];
	for (const error of errors || []) {
		const message = normalizeMessage(error);
		if (seen.has(message) || excluded.has(message)) {
			continue;
		}
		seen.add(message);
		results.push({ message, code: getErrorCode(error) });
	}
	return results;
}

export function getCircularDependencyData(
	errors: ReporterError[] | null | undefined
): CircularDependencyData[] {
	const seen = new Set<string>();
	const results: CircularDependencyData[] = [];
	for (const error of errors || []) {
		if (!isCircularDependencyError(error)) {
			continue;
		}
		const rawMessage = normalizeMessage(error);
		if (seen.has(rawMessage)) {
			continue;
		}
		seen.add(rawMessage);
		results.push({
			rawMessage,
			message: normalizeCircularDependencyMessage(rawMessage),
		});
	}
	return results;
}

export function buildCircularDependencySection(
	errors: ReporterError[] | null | undefined,
	palette: Palette
): string[] {
	const circularData = getCircularDependencyData(errors);
	if (circularData.length === 0) {
		return [];
	}
	const lines: string[] = [];
	lines.push(palette.errorHeader('Circular Dependencies'));
	lines.push(palette.error('---------------------'));
	circularData.forEach(({ message }) => {
		lines.push(`${palette.error('-')} ${palette.error(message)}`);
	});
	return lines;
}

export function buildErrorsSection(
	errors: ReporterError[] | null | undefined,
	palette: Palette,
	{ excludeMessages = [] }: { excludeMessages?: string[] } = {}
): string[] {
	const errorsData = getErrorsData(errors, { excludeMessages });
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
