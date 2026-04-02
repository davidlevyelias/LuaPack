import { Command } from 'commander';

import type { CliOptions } from './types';
import { parseEnvOption, parseLogLevel } from './parse';
import { executeCliAction } from './executeCliAction';

export function createProgram(
	packageVersion: string,
	action: (entry: string | undefined, options: CliOptions) => Promise<void> = (
		entry,
		options
	) => executeCliAction(entry, options, packageVersion)
) {
	return new Command()
		.version(packageVersion)
		.description('A modern Lua bundler and analyzer.')
		.argument('[entry]', 'The entry Lua file.')
		.option(
			'-o, --output <file>',
			'Output file (bundle when packing, analysis report when using --analyze).'
		)
		.option('-c, --config <file>', 'Path to a luapack.config.json file.')
		.option(
			'--sourceroot <path>',
			'The root directory for resolving modules.'
		)
		.option('--analyze', 'Run analysis only and skip bundling.')
		.option(
			'--ignore-missing',
			'Continue analysis/bundling when modules cannot be resolved.'
		)
		.option(
			'--env <vars>',
			'Comma-separated environment variables to inspect for external modules (empty string to disable).',
			parseEnvOption
		)
		.option('--verbose', 'Print verbose analysis details (tree and order).')
		.option(
			'--log-level <level>',
			'Set log verbosity (error, warn, info, debug).',
			parseLogLevel
		)
		.action(action);
}

export async function runCli(packageVersion: string, argv: string[] = process.argv) {
	const program = createProgram(packageVersion);
	await program.parseAsync(argv);
}