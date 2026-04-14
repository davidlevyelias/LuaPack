import type { FallbackMode, LuaVersion, MissingPolicy } from '../config/loader';

const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const VALID_LUA_VERSIONS = ['5.1', '5.2', '5.3', 'LuaJIT'] as const;
const VALID_MISSING_POLICIES = ['error', 'warn'] as const;
const VALID_REPORT_FORMATS = ['text', 'json'] as const;

export type CommandName = 'bundle' | 'analyze' | 'init';

export type LogLevel = (typeof VALID_LOG_LEVELS)[number];
export type CliLuaVersion = (typeof VALID_LUA_VERSIONS)[number];
export type CliMissingPolicy = (typeof VALID_MISSING_POLICIES)[number];
export type ReportFormat = (typeof VALID_REPORT_FORMATS)[number];

export interface CliOptions {
	command?: CommandName;
	output?: string;
	report?: string;
	config?: string;
	root?: string;
	entry?: string;
	luaVersion?: LuaVersion;
	file?: string;
	yes?: boolean;
	force?: boolean;
	color?: boolean;
	missing?: MissingPolicy;
	quiet?: boolean;
	printConfig?: boolean;
	fallback?: FallbackMode;
	format?: ReportFormat;
	reportFormat?: ReportFormat;
	verbose?: boolean;
	logLevel?: LogLevel;
}

export {
	VALID_LOG_LEVELS,
	VALID_LUA_VERSIONS,
	VALID_MISSING_POLICIES,
	VALID_REPORT_FORMATS,
};
