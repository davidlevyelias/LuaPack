#!/usr/bin/env node

try {
	require('ts-node/register/transpile-only');
} catch (error) {
	console.error(
		"Unable to load TypeScript runtime. Install 'ts-node' to execute LuaPack CLI."
	);
	process.exit(1);
}

const colors = require('ansi-colors');
const { version: packageVersion } = require('./package.json');

const { program } = require('commander');
const LuaPacker = require('./src/LuaPacker');
const { loadConfig } = require('./src/config/ConfigLoader');
const AnalysisPipeline = require('./src/analysis/AnalysisPipeline.ts').default;
const AnalysisReporter = require('./src/analysis/AnalysisReporter.ts').default;
const logger = require('./src/Logger');

function parseToggle(value) {
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

async function main() {
	program
		.version('1.1.0')
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
		.action(async (entry, options) => {
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
				let bundlePath = null;
				let reportPath = null;

				if (!analyzeOnly && analysis.success) {
					try {
						bundlePath = await packer.pack(analysis);
					} catch (error) {
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
			} catch (error) {
				logger.error(`An error occurred: ${error.message}`);
				process.exit(1);
			}
		});

	await program.parseAsync(process.argv);
}

main();

function printCliHeader({ analyzeOnly }) {
	const title = colors.bgBlue.white.bold(` LuaPack v${packageVersion} `);
	const modeLabel = analyzeOnly
		? colors.bgMagenta.white.bold(' ANALYSIS MODE ')
		: null;
	const headerLine = [title, modeLabel].filter(Boolean).join(' ');
	logger.info('');
	logger.info(headerLine);
	logger.info('');
}

function printBundleSuccess(bundlePath) {
	const label = colors.green('Bundle successfully created at:');
	const formattedPath = colors.bold.underline(bundlePath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

function printReportSuccess(reportPath) {
	const label = colors.green('Analysis report saved to:');
	const formattedPath = colors.bold.underline(reportPath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

function parseEnvOption(value) {
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
