import { Command } from 'commander';

import type { CliOptions, CommandName } from './types';
import { printJsonErrorPayload } from './output';
import {
	parseFallbackMode,
	parseLogLevel,
	parseLuaVersion,
	parseMissingPolicy,
	parseReportFormat,
} from './parse';
import { executeCliAction } from './executeCliAction';

function addCommonOptions(
	command: Command,
	{
		includeFormat,
		includeBundleReport,
	}: {
		includeFormat: boolean;
		includeBundleReport: boolean;
	}
) {
	command
		.optionsGroup('Input Options:')
		.option('-c, --config <file>', 'Path to a luapack.config.json file.')
		.option(
			'-o, --output <file>',
			'Output file for the generated bundle artifact (bundle) or analysis report (analyze).'
		)
		.option(
			'--root <path>',
			'Default package root path for this run.'
		)
		.option(
			'--lua-version <version>',
			'Lua grammar version for dependency parsing (5.1, 5.2, 5.3, LuaJIT).',
			parseLuaVersion
		)
		.optionsGroup('Analysis Options:')
		.option(
			'--missing <policy>',
			'Missing-module policy (error, warn).',
			parseMissingPolicy
		)
		.option(
			'--fallback <policy>',
			'Runtime fallback policy (never, external-only, always).',
			parseFallbackMode
		);

	command.option('--verbose', 'Print verbose analysis details.');

	if (includeFormat) {
		command.option(
			'--format <format>',
			'Visual output format (text, json).',
			parseReportFormat
		);
	}

	if (includeBundleReport) {
		command
			.optionsGroup('Report Options:')
			.option(
				'--report <file>',
				'Write bundle analysis report to a file.'
			)
			.option(
				'--report-format <format>',
				'Bundle analysis report format (text, json).',
				parseReportFormat
			);
	}

	command
		.optionsGroup('Display Options:')
		.option('--no-color', 'Disable ANSI color in terminal text output.')
		.option(
			'--quiet',
			'Suppress informational CLI output and keep warnings/errors only.'
		)
		.option(
			'--print-config',
			'Print the effective normalized v2 config and exit.'
		)
		.option(
			'--log-level <level>',
			'Set log verbosity (error, warn, info, debug).',
			parseLogLevel
		);

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
		{
			includeFormat: true,
			includeBundleReport: true,
		}
	).action((entry: string | undefined, options: CliOptions) => {
		return action('bundle', entry, { ...options, command: 'bundle' });
	});

	addCommonOptions(
		program
			.command('analyze [entry]')
			.description(
				'Analyze the dependency graph and optionally write a report.'
			),
		{
			includeFormat: true,
			includeBundleReport: false,
		}
	).action((entry: string | undefined, options: CliOptions) => {
		return action('analyze', entry, { ...options, command: 'analyze' });
	});

	program
		.command('init')
		.description('Generate a luapack configuration file interactively.')
		.option(
			'-y, --yes',
			'Accept defaults and skip prompts.'
		)
		.option('--entry <file>', 'Pre-fill entry Lua file path.')
		.option('--output <file>', 'Pre-fill output bundle path.')
		.option('--root <path>', 'Pre-fill default package root.')
		.option(
			'--lua-version <version>',
			'Pre-fill Lua grammar version (5.1, 5.2, 5.3, LuaJIT).',
			parseLuaVersion
		)
		.option(
			'--missing <policy>',
			'Pre-fill missing-module policy (error, warn).',
			parseMissingPolicy
		)
		.option(
			'-f, --force',
			'Overwrite existing config without confirmation.'
		)
		.option(
			'--file <path>',
			'Config file name or path (default: luapack.config.json).'
		)
		.action((options: CliOptions) => {
			return action('init', undefined, {
				...options,
				command: 'init',
			});
		});

	program.action(() => {
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
	const jsonErrorCommand = resolveJsonErrorCommand(argv);
	if (jsonErrorCommand) {
		applyJsonErrorMode(program);
	}
	try {
		await program.parseAsync(argv);
	} catch (error: any) {
		if (jsonErrorCommand) {
			printJsonErrorPayload({
				type: 'command-error',
				status: 'error',
				command: jsonErrorCommand,
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
	applyJsonErrorModeToCommand(program);
}

function applyJsonErrorModeToCommand(command: Command): void {
	command.exitOverride();
	command.showHelpAfterError(false);
	command.showSuggestionAfterError(false);
	command.configureOutput({
		writeOut: () => {},
		writeErr: () => {},
		outputError: () => {},
	});
	command.commands.forEach((subcommand) => applyJsonErrorModeToCommand(subcommand));
}

function resolveJsonErrorCommand(
	argv: string[]
): 'analyze' | 'bundle' | null {
	const args = Array.isArray(argv) ? argv.slice(2) : [];
	const commandName = args[0];
	if (commandName !== 'analyze' && commandName !== 'bundle') {
		return null;
	}

	for (let index = 1; index < args.length; index += 1) {
		const token = args[index];
		if (token === '--format' && args[index + 1] === 'json') {
			return commandName;
		}
		if (token.startsWith('--format=')) {
			if (token.slice('--format='.length) === 'json') {
				return commandName;
			}
		}
	}

	return null;
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
