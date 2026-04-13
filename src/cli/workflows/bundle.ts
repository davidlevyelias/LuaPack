import AnalysisPipeline from '../../analysis/AnalysisPipeline';
import AnalysisReporter from '../../analysis/AnalysisReporter';
import { LuaPacker } from '../../bundle';
import { getNormalizedV2Config, setAnalyzeOnlyConfig } from '../../config/loader';
import logger from '../../utils/Logger';

import type { CliOptions } from '../types';
import {
	printBundleFailed,
	printBundleSuccess,
	printCliHeader,
	printConfigSnapshot,
	printReportSuccess,
} from '../output';
import {
	loadWorkflowConfig,
	resolveAnalyzeFormat,
	resolveBundleReportFormat,
} from './common';

type WorkflowContext = {
	analysis: ReturnType<AnalysisPipeline['run']>;
	reporter: AnalysisReporter;
	packer: LuaPacker;
};

function createWorkflowContext(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string,
	{
		analyzeOnly,
		showHeader = true,
	}: { analyzeOnly: boolean; showHeader?: boolean }
): WorkflowContext {
	const config = loadWorkflowConfig(entry, options);
	if (showHeader) {
		printCliHeader({ analyzeOnly, packageVersion });
	}

	if (analyzeOnly) {
		setAnalyzeOnlyConfig(config, true);
	}

	const packer = new LuaPacker(config);
	const workflowConfig = packer.getConfig();
	const analysisPipeline = new AnalysisPipeline(workflowConfig, { logger });

	return {
		analysis: analysisPipeline.run(),
		reporter: new AnalysisReporter({
			logger,
			packageVersion,
			useColor: options.color === false ? false : undefined,
		}),
		packer,
	};
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
	const effectiveFormat = resolveAnalyzeFormat(options);
	const shouldPrintStructuredReport = !options.report;

	const context = createWorkflowContext(entry, options, packageVersion, {
		analyzeOnly: false,
		showHeader: false,
	});
	let bundlePath: string | null = null;
	let reportPath: string | null = null;
	let footerSpacingPrinted = false;

	function printFooterSpacingOnce() {
		if (footerSpacingPrinted) {
			return;
		}
		logger.info('');
		footerSpacingPrinted = true;
	}

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
			context.reporter.printConsoleReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		}
	}

	if (reportPath) {
		printFooterSpacingOnce();
		printReportSuccess(reportPath, {
			useColor: options.color === false ? false : undefined,
		});
	}

	if (bundlePath && context.analysis.success && effectiveFormat === 'text') {
		printFooterSpacingOnce();
		printBundleSuccess(bundlePath, {
			useColor: options.color === false ? false : undefined,
		});
	}

	if (!context.analysis.success && effectiveFormat === 'text') {
		printFooterSpacingOnce();
		printBundleFailed({
			useColor: options.color === false ? false : undefined,
		});
	}
}
