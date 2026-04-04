#!/usr/bin/env node
import { version as packageVersion } from '../package.json';

import {
	createProgram as createCliProgram,
	executeCliAction as executeCliWorkflow,
	parseBundleMode,
	parseFallbackMode,
	parseMissingPolicy,
	parseReportFormat,
	parseEnvOption,
	parseLogLevel,
	printBundleSuccess,
	printCliHeader as printCliHeaderMessage,
	printReportSuccess,
	runCli as runCliProgram,
} from './cli';

export type { CliOptions, LogLevel } from './cli';

export {
	parseEnvOption,
	parseBundleMode,
	parseFallbackMode,
	parseLogLevel,
	parseMissingPolicy,
	parseReportFormat,
	printBundleSuccess,
	printReportSuccess,
};

export function printCliHeader({ analyzeOnly }: { analyzeOnly: boolean }) {
	return printCliHeaderMessage({ analyzeOnly, packageVersion });
}

export async function executeCliAction(
	commandName: import('./cli').CommandName,
	entry: string | undefined,
	options: import('./cli').CliOptions
) {
	return executeCliWorkflow(commandName, entry, options, packageVersion);
}

export function createProgram(
	action: (
		commandName: import('./cli').CommandName,
		entry: string | undefined,
		options: import('./cli').CliOptions
	) => Promise<void> = executeCliAction
) {
	return createCliProgram(packageVersion, action);
}

export async function runCli(argv: string[] = process.argv) {
	return runCliProgram(packageVersion, argv);
}

if (require.main === module) {
	void runCli();
}
