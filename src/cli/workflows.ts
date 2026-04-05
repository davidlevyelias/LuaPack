import AnalysisPipeline from '../analysis/AnalysisPipeline';
import AnalysisReporter from '../analysis/AnalysisReporter';
import { LuaPacker } from '../bundle';
import { loadConfig } from '../config/ConfigLoader';
import {
	getNormalizedV2Config,
	setAnalyzeOnlyConfig,
} from '../config/loader';
import logger from '../Logger';

import type { CliOptions } from './types';
import {
	printBundleSuccess,
	printCliHeader,
	printConfigSnapshot,
	printReportSuccess,
} from './output';

type WorkflowContext = {
	analysis: ReturnType<AnalysisPipeline['run']>;
	reporter: AnalysisReporter;
	packer: LuaPacker;
};

function loadWorkflowConfig(entry: string | undefined, options: CliOptions) {
	return loadConfig({
		entry,
		output: options.output,
		root: options.root,
		config: options.config,
		missing: options.missing,
		envVar: options.envVar,
		fallback: options.fallback,
	});
}

function createWorkflowContext(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string,
	{ analyzeOnly }: { analyzeOnly: boolean }
): WorkflowContext {
	const useColor = options.color !== false;
	printCliHeader({ analyzeOnly, packageVersion, useColor });
	const config = loadWorkflowConfig(entry, options);

	if (analyzeOnly) {
		setAnalyzeOnlyConfig(config, true);
	}

	const packer = new LuaPacker(config);
	const workflowConfig = packer.getConfig();
	const analysisPipeline = new AnalysisPipeline(workflowConfig, { logger });

	return {
		analysis: analysisPipeline.run(),
		reporter: new AnalysisReporter({ logger, useColor }),
		packer,
	};
}

export async function runAnalyzeWorkflow(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	if (options.printConfig) {
		const config = loadWorkflowConfig(entry, options);
		printConfigSnapshot(getNormalizedV2Config(config));
		return;
	}

	const context = createWorkflowContext(entry, options, packageVersion, {
		analyzeOnly: true,
	});
	let reportPath: string | null = null;

	if (options.output) {
		reportPath = await context.reporter.writeReport(
			options.output,
			context.analysis,
			{
				verbose: Boolean(options.verbose),
				format: options.format,
			}
		);
	}

	context.reporter.printConsoleReport(context.analysis, {
		verbose: Boolean(options.verbose),
	});

	if (reportPath) {
		printReportSuccess(reportPath, { useColor: options.color !== false });
	}

	if (!context.analysis.success) {
		process.exitCode = 1;
	}
}

export async function runBundleWorkflow(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	if (options.printConfig) {
		const config = loadWorkflowConfig(entry, options);
		printConfigSnapshot(getNormalizedV2Config(config));
		return;
	}

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
		printBundleSuccess(bundlePath, { useColor: options.color !== false });
	}

	if (!context.analysis.success) {
		process.exitCode = 1;
	}
}