import { Command } from 'commander';

import type { CliOptions, CommandName } from './types';
import { printJsonErrorPayload } from './output';
import {
	collectRepeatableValue,
	parseFallbackMode,
	parseLogLevel,
	parseMissingPolicy,
	parseReportFormat,
} from './parse';
import { executeCliAction } from './executeCliAction';

function addCommonOptions(
	command: Command,
	{
		includeVerbose,
		includeFormat,
	}: {
		includeVerbose: boolean;
		includeFormat: boolean;
	}
) {
	command
		.option('-c, --config <file>', 'Path to a luapack.config.json file.')
		.option(
			'-o, --output <file>',
			'Output file for the generated artifact or analysis report.'
		)
		.option('--no-color', 'Disable ANSI color output.')
		.option(
			'--quiet',
			'Suppress informational CLI output and keep warnings/errors only.'
		)
		.option(
			'--print-config',
			'Print the effective normalized v2 config and exit.'
		)
		.option(
			'--root <path>',
			'Default package root for this run. Repeat to replace the effective value.',
			collectRepeatableValue
		)
		.option(
			'--missing <policy>',
			'Missing-module policy (error, warn, ignore).',
			parseMissingPolicy
		)
		.option(
			'--fallback <policy>',
			'Runtime fallback policy (never, external-only, always).',
			parseFallbackMode
		)
		.option(
			'--log-level <level>',
			'Set log verbosity (error, warn, info, debug).',
			parseLogLevel
		);

	if (includeVerbose) {
		command.option(
			'--verbose',
			'Print verbose analysis details (tree and order).'
		);
	}

	if (includeFormat) {
		command.option(
			'--format <format>',
			'Analysis report format (text, json).',
			parseReportFormat
		);
	}

	return command;
}

export function createProgram(
	packageVersion: string,
	action: (
		commandName: CommandName,
		entry: string | undefined,
		options: CliOptions
	) => Promise<void> = (commandName, entry, options) =>
		executeCliAction(commandName, entry, options, packageVersion)
) {
	const program = new Command()
		.version(packageVersion)
		.description('A modern Lua bundler and analyzer.')
		.showHelpAfterError();

	addCommonOptions(
		program
			.command('bundle [entry]')
			.description('Analyze the dependency graph and build a bundle.'),
		{ includeVerbose: false, includeFormat: false }
	).action((entry: string | undefined, options: CliOptions) => {
		return action('bundle', entry, { ...options, command: 'bundle' });
	});

	addCommonOptions(
		program
			.command('analyze [entry]')
			.description(
				'Analyze the dependency graph and optionally write a report.'
			),
		{ includeVerbose: true, includeFormat: true }
	).action((entry: string | undefined, options: CliOptions) => {
		return action('analyze', entry, { ...options, command: 'analyze' });
	});

	program.action(() => {
		program.outputHelp();
		program.error('A subcommand is required.', {
			exitCode: 2,
			code: 'luapack.subcommandRequired',
		});
	});

	return program;
}

export async function runCli(
	packageVersion: string,
	argv: string[] = process.argv
) {
	const program = createProgram(packageVersion);
	if (shouldEmitJsonCommandError(argv)) {
		applyJsonErrorMode(program);
	}
	try {
		await program.parseAsync(argv);
	} catch (error: any) {
		if (shouldEmitJsonCommandError(argv)) {
			printJsonErrorPayload({
				type: 'command-error',
				status: 'error',
				command: 'analyze',
				error: {
					type: inferCliParseErrorType(error),
					code: normalizeErrorCode(error?.code),
					message:
						error instanceof Error ? error.message : String(error),
				},
			});
			process.exitCode = 1;
			return;
		}

		throw error;
	}
}

function applyJsonErrorMode(program: Command): void {
	program.exitOverride();
	program.commands.forEach((command) => command.exitOverride());
	program.configureOutput({
		writeOut: () => {},
		writeErr: () => {},
	});
}

function shouldEmitJsonCommandError(argv: string[]): boolean {
	const args = Array.isArray(argv) ? argv.slice(2) : [];
	const isAnalyzeCommand = args.includes('analyze');
	if (!isAnalyzeCommand) {
		return false;
	}

	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (token === '--format' && args[index + 1] === 'json') {
			return true;
		}
		if (token.startsWith('--format=')) {
			return token.slice('--format='.length) === 'json';
		}
	}

	return false;
}

function inferCliParseErrorType(
	error: unknown
): 'usage' | 'config' | 'runtime' {
	const message = error instanceof Error ? error.message : String(error);
	if (
		(error as { code?: string } | null)?.code ===
			'commander.invalidArgument' ||
		message.includes('unknown option') ||
		message.includes('too many arguments') ||
		message.includes('missing required argument') ||
		message.includes('Expected one of:') ||
		message.includes('A subcommand is required.')
	) {
		return 'usage';
	}
	return 'runtime';
}

function normalizeErrorCode(code: unknown): string {
	if (typeof code !== 'string' || code.length === 0) {
		return 'usage-error';
	}
	return code
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
