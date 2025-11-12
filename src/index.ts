#!/usr/bin/env node
import colors from 'ansi-colors';
import { program } from 'commander';
import { version as packageVersion } from '../package.json';

import LuaPacker from './LuaPacker';
import { loadConfig } from './config/ConfigLoader';
// Prefer compiled JS from build/ to avoid TS runtime in production installs
import AnalysisPipeline from './analysis/AnalysisPipeline';
import AnalysisReporter from './analysis/AnalysisReporter';
import logger from './Logger';

function parseToggle(value: string | undefined): boolean {
	if (value === undefined) {
		return true;
	}
	const normalized = String(value).toLowerCase();
	if (['true', '1', 'yes', 'on'].includes(normalized)) {
		return true;
	}
	if (['false', '0', 'no', 'off'].includes(normalized)) {
		return false;
	}
	return Boolean(value);
}

interface IOptions {
	output?: string;
	config?: string;
	sourceroot?: string;
	renameVariables?: boolean;
	minify?: boolean;
	ascii?: boolean;
	analyze?: boolean;
	ignoreMissing?: boolean;
	env?: string;
	verbose?: boolean;
	logLevel?: string;
}

async function main() {
	program
		.version(packageVersion)
		.description('A modern Lua bundler and obfuscator.')
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
		.option(
			'--rename-variables [state]',
			'Set variable renaming obfuscation (true/false).',
			parseToggle
		)
		.option(
			'--minify [state]',
			'Set Lua minification obfuscation (true/false).',
			parseToggle
		)
		.option(
			'--ascii [state]',
			'Set ASCII obfuscation (true/false).',
			parseToggle
		)
		.option('--analyze', 'Run analysis only and skip bundling.')
		.option(
			'--ignore-missing',
			'Continue analysis/bundling when modules cannot be resolved.'
		)
		.option(
			'--env <vars>',
			'Comma-separated environment variables to inspect for external modules (empty string to disable).'
		)
		.option('--verbose', 'Print verbose analysis details (tree and order).')
		.option(
			'--log-level <level>',
			'Set log verbosity (error, warn, info, debug).'
		)
		.action(async (entry: string, options: IOptions) => {
			try {
				if (options.logLevel) {
					logger.setLevel(options.logLevel);
				}
				const analyzeOnly = Boolean(options.analyze);
				printCliHeader({ analyzeOnly });
				const envOption = parseEnvOption(options.env);
				const config = loadConfig({
					entry,
					output: analyzeOnly ? undefined : options.output,
					sourceroot: options.sourceroot,
					config: options.config,
					ignoreMissing: options.ignoreMissing,
					renameVariables: options.renameVariables,
					minify: options.minify,
					ascii: options.ascii,
					env: envOption,
				});

				// mark analysis-only mode on the config so downstream code (reporter/pipeline)
				// can adjust behaviour (e.g., hide bundle size when only analyzing)
				if (analyzeOnly) {
					config._analyzeOnly = true;
				}

				const packer = new LuaPacker(config);
				const workflowConfig = packer.getConfig();
				const analysisPipeline = new AnalysisPipeline(workflowConfig, {
					logger,
				});
				const analysis = analysisPipeline.run();
				const reporter = new AnalysisReporter({ logger });
				let bundlePath: string | null = null;
				let reportPath: string | null = null;

				if (!analyzeOnly && analysis.success) {
					try {
						bundlePath = await packer.pack(analysis);
					} catch (error: any) {
						analysis.errors.push(error);
						analysis.success = false;
						logger.error(
							`Failed to create bundle: ${error.message}`
						);
					}
				}

				if (analyzeOnly && options.output) {
					const savedPath = await reporter.writeReport(
						options.output,
						analysis,
						{
							verbose: Boolean(options.verbose),
						}
					);
					reportPath = savedPath;
				}

				reporter.printConsoleReport(analysis, {
					verbose: Boolean(options.verbose),
				});

				if (reportPath) {
					printReportSuccess(reportPath);
				}

				if (bundlePath && analysis.success) {
					printBundleSuccess(bundlePath);
				}

				if (!analysis.success) {
					process.exitCode = 1;
					return;
				}

				if (analyzeOnly) {
					return;
				}
			} catch (error: any) {
				logger.error(`An error occurred: ${error.message}`);
				process.exit(1);
			}
		});

	await program.parseAsync(process.argv);
}

main();

function printCliHeader({ analyzeOnly }: { analyzeOnly: boolean }) {
	const title = colors.bgBlue.white.bold(` LuaPack v${packageVersion} `);
	const modeLabel = analyzeOnly
		? colors.bgMagenta.white.bold(' ANALYSIS MODE ')
		: null;
	const headerLine = [title, modeLabel].filter(Boolean).join(' ');
	logger.info('');
	logger.info(headerLine);
	logger.info('');
}

function printBundleSuccess(bundlePath: string) {
	const label = colors.green('Bundle successfully created at:');
	const formattedPath = colors.bold.underline(bundlePath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

function printReportSuccess(reportPath: string) {
	const label = colors.green('Analysis report saved to:');
	const formattedPath = colors.bold.underline(reportPath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

function parseEnvOption(value: string | undefined): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string') {
		return [];
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}
	return trimmed
		.split(',')
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}
