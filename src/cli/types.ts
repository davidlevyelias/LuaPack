import type { BundleMode, FallbackMode, MissingPolicy } from '../config/loader';

const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const VALID_MISSING_POLICIES = ['error', 'warn', 'ignore'] as const;

export type CommandName = 'bundle' | 'analyze';

export type LogLevel = (typeof VALID_LOG_LEVELS)[number];
export type CliMissingPolicy = (typeof VALID_MISSING_POLICIES)[number];

export interface CliOptions {
	command?: CommandName;
	output?: string;
	config?: string;
	root?: string[];
	missing?: MissingPolicy;
	envVar?: string[];
	mode?: BundleMode;
	fallback?: FallbackMode;
	verbose?: boolean;
	logLevel?: LogLevel;
}

export { VALID_LOG_LEVELS, VALID_MISSING_POLICIES };