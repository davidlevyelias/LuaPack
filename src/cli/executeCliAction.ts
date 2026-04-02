import LuaPacker from '../LuaPacker';
import { loadConfig } from '../config/ConfigLoader';
import AnalysisPipeline from '../analysis/AnalysisPipeline';
import AnalysisReporter from '../analysis/AnalysisReporter';
import logger from '../Logger';

import type { CliOptions } from './types';
import { printBundleSuccess, printCliHeader, printReportSuccess } from './output';

export async function executeCliAction(
	entry: string | undefined,
	options: CliOptions,
	packageVersion: string
) {
	try {
		if (options.logLevel) {
			logger.setLevel(options.logLevel);
		}
		const analyzeOnly = Boolean(options.analyze);
		printCliHeader({ analyzeOnly, packageVersion });
		const config = loadConfig({
			entry,
			output: analyzeOnly ? undefined : options.output,
			sourceroot: options.sourceroot,
			config: options.config,
			ignoreMissing: options.ignoreMissing,
			env: options.env,
		});

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
				logger.error(`Failed to create bundle: ${error.message}`);
			}
		}

		if (analyzeOnly && options.output) {
			reportPath = await reporter.writeReport(options.output, analysis, {
				verbose: Boolean(options.verbose),
			});
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
		}
	} catch (error: any) {
		logger.error(`An error occurred: ${error.message}`);
		process.exit(1);
	}
}