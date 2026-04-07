import { InvalidArgumentError } from 'commander';

import { FALLBACK_MODES } from '../config/loader/constants';
import type { FallbackMode } from '../config/loader';
import {
	VALID_LOG_LEVELS,
	VALID_MISSING_POLICIES,
	VALID_REPORT_FORMATS,
	type CliMissingPolicy,
	type LogLevel,
	type ReportFormat,
} from './types';

export function parseLogLevel(value: string): LogLevel {
	const normalized = String(value).trim().toLowerCase();
	if ((VALID_LOG_LEVELS as readonly string[]).includes(normalized)) {
		return normalized as LogLevel;
	}
	throw new InvalidArgumentError(
		`Expected one of: ${VALID_LOG_LEVELS.join(', ')}`
	);
}

export function parseEnvOption(
	value: string | undefined
): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string') {
		return [];
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}
	const tokens = trimmed.split(',').map((token) => token.trim());
	if (tokens.some((token) => token.length === 0)) {
		throw new InvalidArgumentError(
			'Expected a comma-separated list of non-empty environment variable names, or an empty string to disable env lookup.'
		);
	}
	return tokens;
}

export function parseMissingPolicy(value: string): CliMissingPolicy {
	const normalized = String(value).trim().toLowerCase();
	if ((VALID_MISSING_POLICIES as readonly string[]).includes(normalized)) {
		return normalized as CliMissingPolicy;
	}
	throw new InvalidArgumentError(
		`Expected one of: ${VALID_MISSING_POLICIES.join(', ')}`
	);
}

export function parseRepeatableValue(value: string): string {
	const normalized = String(value).trim();
	if (!normalized) {
		throw new InvalidArgumentError('Expected a non-empty value.');
	}
	return normalized;
}

export function collectRepeatableValue(
	value: string,
	previous: string[] = []
): string[] {
	return [...previous, parseRepeatableValue(value)];
}

export function parseFallbackMode(value: string): FallbackMode {
	const normalized = String(value).trim().toLowerCase();
	if (FALLBACK_MODES.has(normalized)) {
		return normalized as FallbackMode;
	}
	throw new InvalidArgumentError(
		`Expected one of: ${Array.from(FALLBACK_MODES).join(', ')}`
	);
}

export function parseReportFormat(value: string): ReportFormat {
	const normalized = String(value).trim().toLowerCase();
	if ((VALID_REPORT_FORMATS as readonly string[]).includes(normalized)) {
		return normalized as ReportFormat;
	}
	throw new InvalidArgumentError(
		`Expected one of: ${VALID_REPORT_FORMATS.join(', ')}`
	);
}
