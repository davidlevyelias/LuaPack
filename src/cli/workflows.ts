import AnalysisPipeline from '../analysis/AnalysisPipeline';
import AnalysisReporter from '../analysis/AnalysisReporter';
import { LuaPacker } from '../bundle';
import { loadConfig } from '../config/ConfigLoader';
import { getNormalizedV2Config, setAnalyzeOnlyConfig } from '../config/loader';
import logger from '../utils/Logger';

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
		fallback: options.fallback,
	});
}

function loadAnalyzeConfig(entry: string | undefined, options: CliOptions) {
	return loadConfig({
		entry,
		root: options.root,
		config: options.config,
		missing: options.missing,
		fallback: options.fallback,
	});
}

function resolveAnalyzeFormat(options: CliOptions): 'pretty' | 'text' | 'json' {
	return options.format ?? 'pretty';
}

function resolveBundleReportFormat(
	options: CliOptions
): 'text' | 'json' | undefined {
	return options.reportFormat;
}

function createWorkflowContext(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string,
	{
		analyzeOnly,
		showHeader = true,
	}: { analyzeOnly: boolean; showHeader?: boolean }
): WorkflowContext {
	const useColor = options.color !== false;
	const config = loadWorkflowConfig(entry, options);
	if (showHeader) {
		printCliHeader({ analyzeOnly, packageVersion, useColor });
	}

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
		const config = loadAnalyzeConfig(entry, options);
		printConfigSnapshot(getNormalizedV2Config(config));
		return;
	}

	const effectiveFormat = resolveAnalyzeFormat(options);
	if (options.output && !options.format) {
		throw Object.assign(
			new Error(
				'Analyze output requires --format text or --format json.'
			),
			{ code: 'ANALYZE_OUTPUT_REQUIRES_FORMAT', errorType: 'usage' }
		);
	}

	const useColor = options.color !== false;
	const config = loadAnalyzeConfig(entry, options);
	if (effectiveFormat === 'pretty') {
		printCliHeader({ analyzeOnly: true, packageVersion, useColor });
	}
	setAnalyzeOnlyConfig(config, true);

	const packer = new LuaPacker(config);
	const workflowConfig = packer.getConfig();
	const analysisPipeline = new AnalysisPipeline(workflowConfig, { logger });

	const context = {
		analysis: analysisPipeline.run(),
		reporter: new AnalysisReporter({ logger, useColor }),
		packer,
	};
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

	if (effectiveFormat === 'json') {
		if (!options.output) {
			context.reporter.printJsonReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		}
	} else if (effectiveFormat === 'text') {
		if (!options.output) {
			context.reporter.printTextReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		}
	} else {
		context.reporter.printConsoleReport(context.analysis, {
			verbose: Boolean(options.verbose),
		});
	}

	if (reportPath) {
		printReportSuccess(reportPath, { useColor: options.color !== false });
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

	const reportFormat = resolveBundleReportFormat(options);
	if (options.report && !options.reportFormat) {
		throw Object.assign(
			new Error(
				'Bundle report output requires --report-format text or --report-format json.'
			),
			{ code: 'BUNDLE_REPORT_REQUIRES_FORMAT', errorType: 'usage' }
		);
	}
	const effectiveFormat = resolveAnalyzeFormat(options);

	const shouldPrintPrettyReport = effectiveFormat === 'pretty';
	const shouldPrintStructuredReport =
		effectiveFormat !== 'pretty' && !options.report;

	const context = createWorkflowContext(entry, options, packageVersion, {
		analyzeOnly: false,
		showHeader: shouldPrintPrettyReport,
	});
	let bundlePath: string | null = null;
	let reportPath: string | null = null;

	if (context.analysis.success) {
		try {
			bundlePath = await context.packer.pack(context.analysis);
		} catch (error: any) {
			context.analysis.errors.push(error);
			context.analysis.success = false;
			logger.error(`Failed to create bundle: ${error.message}`);
		}
	}

	if (options.report) {
		reportPath = await context.reporter.writeReport(
			options.report,
			context.analysis,
			{
				verbose: Boolean(options.verbose),
				format: reportFormat,
			}
		);
	}

	if (shouldPrintStructuredReport) {
		if (effectiveFormat === 'json') {
			context.reporter.printJsonReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		} else {
			context.reporter.printTextReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		}
	} else if (shouldPrintPrettyReport) {
		context.reporter.printConsoleReport(context.analysis, {
			verbose: Boolean(options.verbose),
		});
	}

	if (reportPath) {
		printReportSuccess(reportPath, { useColor: options.color !== false });
	}

	if (bundlePath && context.analysis.success && shouldPrintPrettyReport) {
		printBundleSuccess(bundlePath, { useColor: options.color !== false });
	}

	if (!context.analysis.success) {
		process.exitCode = 1;
	}
}
