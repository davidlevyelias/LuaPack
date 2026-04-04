import { LuaPacker } from '../bundle';
import { loadConfig } from '../config/ConfigLoader';
import AnalysisPipeline from '../analysis/AnalysisPipeline';
import AnalysisReporter from '../analysis/AnalysisReporter';
import logger from '../Logger';

import type { CliOptions, CommandName } from './types';
import { printBundleSuccess, printCliHeader, printReportSuccess } from './output';

type WorkflowContext = {
	config: ReturnType<typeof loadConfig>;
	analysis: ReturnType<AnalysisPipeline['run']>;
	reporter: AnalysisReporter;
	packer: LuaPacker;
};

export async function executeCliAction(
	commandName: CommandName,
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	try {
		if (options.logLevel) {
			logger.setLevel(options.logLevel);
		}
		if (commandName === 'analyze') {
			await runAnalyzeWorkflow(entry, options, packageVersion);
		} else {
			await runBundleWorkflow(entry, options, packageVersion);
		}
	} catch (error: any) {
		logger.error(`An error occurred: ${error.message}`);
		process.exit(1);
	}
}

function createWorkflowContext(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string,
	{ analyzeOnly }: { analyzeOnly: boolean }
): WorkflowContext {
	printCliHeader({ analyzeOnly, packageVersion });
	const config = loadConfig({
		entry,
		output: options.output,
		root: options.root,
		config: options.config,
		missing: options.missing,
		envVar: options.envVar,
		mode: options.mode,
		fallback: options.fallback,
	});

	if (analyzeOnly) {
		config._analyzeOnly = true;
	}

	const packer = new LuaPacker(config);
	const workflowConfig = packer.getConfig();
	const analysisPipeline = new AnalysisPipeline(workflowConfig, { logger });

	return {
		config,
		analysis: analysisPipeline.run(),
		reporter: new AnalysisReporter({ logger }),
		packer,
	};
}

async function runAnalyzeWorkflow(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	const context = createWorkflowContext(entry, options, packageVersion, {
		analyzeOnly: true,
	});
	let reportPath: string | null = null;

	if (options.output) {
		reportPath = await context.reporter.writeReport(options.output, context.analysis, {
			verbose: Boolean(options.verbose),
		});
	}

	context.reporter.printConsoleReport(context.analysis, {
		verbose: Boolean(options.verbose),
	});

	if (reportPath) {
		printReportSuccess(reportPath);
	}

	if (!context.analysis.success) {
		process.exitCode = 1;
	}
}

async function runBundleWorkflow(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	const context = createWorkflowContext(entry, options, packageVersion, {
		analyzeOnly: false,
	});
	let bundlePath: string | null = null;

	if (context.analysis.success) {
		try {
			bundlePath = await context.packer.pack(context.analysis);
		} catch (error: any) {
			context.analysis.errors.push(error);
			context.analysis.success = false;
			logger.error(`Failed to create bundle: ${error.message}`);
		}
	}

	context.reporter.printConsoleReport(context.analysis, {
		verbose: Boolean(options.verbose),
	});

	if (bundlePath && context.analysis.success) {
		printBundleSuccess(bundlePath);
	}

	if (!context.analysis.success) {
		process.exitCode = 1;
	}
}