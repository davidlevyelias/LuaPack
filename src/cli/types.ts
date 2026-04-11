import type { FallbackMode, MissingPolicy } from '../config/loader';

const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const VALID_MISSING_POLICIES = ['error', 'warn'] as const;
const VALID_REPORT_FORMATS = ['text', 'json'] as const;

export type CommandName = 'bundle' | 'analyze';

export type LogLevel = (typeof VALID_LOG_LEVELS)[number];
export type CliMissingPolicy = (typeof VALID_MISSING_POLICIES)[number];
export type ReportFormat = (typeof VALID_REPORT_FORMATS)[number];

export interface CliOptions {
	command?: CommandName;
	output?: string;
	report?: string;
	config?: string;
	root?: string;
	missing?: MissingPolicy;
	color?: boolean;
	quiet?: boolean;
	printConfig?: boolean;
	fallback?: FallbackMode;
	format?: ReportFormat;
	reportFormat?: ReportFormat;
	verbose?: boolean;
	logLevel?: LogLevel;
}

export { VALID_LOG_LEVELS, VALID_MISSING_POLICIES, VALID_REPORT_FORMATS };
