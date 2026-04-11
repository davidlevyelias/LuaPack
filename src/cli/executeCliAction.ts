import logger from '../utils/Logger';

import type { CliOptions, CommandName } from './types';
import { printJsonErrorPayload } from './output';
import { runAnalyzeWorkflow, runBundleWorkflow } from './workflows';

type CliExecutionError = Error & {
	code?: string;
	errorType?: 'usage' | 'config' | 'runtime';
	name?: string;
};

export async function executeCliAction(
	commandName: CommandName,
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	try {
		if (options.quiet) {
			logger.setLevel('warn');
		} else if (options.logLevel) {
			logger.setLevel(options.logLevel);
		}
		if (commandName === 'analyze') {
			await runAnalyzeWorkflow(entry, options, packageVersion);
		} else {
			await runBundleWorkflow(entry, options, packageVersion);
		}
	} catch (error: any) {
		const normalizedError = normalizeCliError(error);

		if (shouldEmitJsonError(options)) {
			printJsonErrorPayload({
				type: 'command-error',
				status: 'error',
				command: commandName,
				error: {
					type: normalizedError.type,
					code: normalizedError.code,
					message: normalizedError.message,
					details: normalizedError.details,
				},
			});
		} else {
			if (normalizedError.type === 'config') {
				const firstDetail = (normalizedError.details || [])[0];
				if (firstDetail) {
					logger.error(
						`${normalizedError.message} ${firstDetail.replace(/^[-\s]+/, '')}`
					);
				} else {
					logger.error(normalizedError.message);
				}
			} else {
				logger.error(`An error occurred: ${normalizedError.message}`);
			}
		}

		process.exitCode = 1;
	}
}

function shouldEmitJsonError(options: CliOptions): boolean {
	return options.format === 'json';
}

function normalizeCliError(error: unknown): {
	type: 'usage' | 'config' | 'runtime';
	code: string;
	message: string;
	details?: string[];
} {
	const fallbackMessage =
		error instanceof Error ? error.message : String(error);
	const cliError = (
		error instanceof Error ? error : new Error(fallbackMessage)
	) as CliExecutionError;
	const type = cliError.errorType ?? inferErrorType(cliError);
	const code = normalizeErrorCode(cliError.code, type);
	const details = extractErrorDetails(cliError.message, type);

	return {
		type,
		code,
		message: details ? cliError.message.split('\n')[0] : cliError.message,
		...(details ? { details } : {}),
	};
}

function inferErrorType(
	error: CliExecutionError
): 'usage' | 'config' | 'runtime' {
	const message = error.message || '';
	if (
		error.name === 'InvalidArgumentError' ||
		message.includes('Expected one of:')
	) {
		return 'usage';
	}
	if (
		message.startsWith('Invalid configuration:') ||
		message.startsWith('Configuration must specify') ||
		message.startsWith('Config file not found') ||
		message.startsWith('Failed to read config file') ||
		message.includes('configuration is no longer supported')
	) {
		return 'config';
	}
	return 'runtime';
}

function normalizeErrorCode(
	code: string | undefined,
	type: 'usage' | 'config' | 'runtime'
): string {
	if (typeof code === 'string' && code.length > 0) {
		return code.toLowerCase().replace(/_/g, '-');
	}
	return type === 'config'
		? 'config-error'
		: type === 'usage'
			? 'usage-error'
			: 'runtime-error';
}

function extractErrorDetails(
	message: string,
	type: 'usage' | 'config' | 'runtime'
): string[] | undefined {
	if (type !== 'config') {
		return undefined;
	}
	const lines = message
		.split('\n')
		.slice(1)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return lines.length > 0 ? lines : undefined;
}
