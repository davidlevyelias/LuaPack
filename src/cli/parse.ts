import { InvalidArgumentError } from 'commander';

import { VALID_LOG_LEVELS, type LogLevel } from './types';

export function parseLogLevel(value: string): LogLevel {
	const normalized = String(value).trim().toLowerCase();
	if ((VALID_LOG_LEVELS as readonly string[]).includes(normalized)) {
		return normalized as LogLevel;
	}
	throw new InvalidArgumentError(
		`Expected one of: ${VALID_LOG_LEVELS.join(', ')}`
	);
}

export function parseEnvOption(value: string | undefined): string[] | undefined {
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