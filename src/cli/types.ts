const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof VALID_LOG_LEVELS)[number];

export interface CliOptions {
	output?: string;
	config?: string;
	sourceroot?: string;
	analyze?: boolean;
	ignoreMissing?: boolean;
	env?: string[];
	verbose?: boolean;
	logLevel?: LogLevel;
}

export { VALID_LOG_LEVELS };