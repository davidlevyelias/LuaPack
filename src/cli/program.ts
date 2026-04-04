import { Command } from 'commander';

import type { CliOptions, CommandName } from './types';
import {
	collectRepeatableValue,
	parseBundleMode,
	parseFallbackMode,
	parseLogLevel,
	parseMissingPolicy,
} from './parse';
import { executeCliAction } from './executeCliAction';

function addCommonOptions(command: Command, { includeVerbose }: { includeVerbose: boolean }) {
	command
		.option('-c, --config <file>', 'Path to a luapack.config.json file.')
		.option('-o, --output <file>', 'Output file for the generated artifact or analysis report.')
		.option(
			'--root <path>',
			'Module search root. Repeat to replace the effective root set.',
			collectRepeatableValue,
			[]
		)
		.option(
			'--missing <policy>',
			'Missing-module policy (error, warn, ignore).',
			parseMissingPolicy
		)
		.option(
			'--env-var <name>',
			'Environment variable name to inspect for module roots. Repeat to replace the effective env list.',
			collectRepeatableValue,
			[]
		)
		.option(
			'--mode <mode>',
			'Bundle mode (runtime, typed).',
			parseBundleMode
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
		command.option('--verbose', 'Print verbose analysis details (tree and order).');
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
		{ includeVerbose: false }
	).action((entry: string | undefined, options: CliOptions) => {
		return action('bundle', entry, { ...options, command: 'bundle' });
	});

	addCommonOptions(
		program
			.command('analyze [entry]')
			.description('Analyze the dependency graph and optionally write a report.'),
		{ includeVerbose: true }
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

export async function runCli(packageVersion: string, argv: string[] = process.argv) {
	const program = createProgram(packageVersion);
	await program.parseAsync(argv);
}