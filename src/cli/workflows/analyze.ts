import AnalysisPipeline from '../../analysis/AnalysisPipeline';
import AnalysisReporter from '../../analysis/AnalysisReporter';
import { LuaPacker } from '../../bundle';
import { getNormalizedV2Config, setAnalyzeOnlyConfig } from '../../config/loader';
import logger from '../../utils/Logger';

import type { CliOptions } from '../types';
import {
	printConfigSnapshot,
	printReportSuccess,
} from '../output';
import { loadAnalyzeConfig, resolveAnalyzeFormat } from './common';

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

	const config = loadAnalyzeConfig(entry, options);
	setAnalyzeOnlyConfig(config, true);

	const packer = new LuaPacker(config);
	const workflowConfig = packer.getConfig();
	const analysisPipeline = new AnalysisPipeline(workflowConfig, { logger });

	const context = {
		analysis: analysisPipeline.run(),
		reporter: new AnalysisReporter({
			logger,
			packageVersion,
			useColor: options.color === false ? false : undefined,
		}),
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
			context.reporter.printConsoleReport(context.analysis, {
				verbose: Boolean(options.verbose),
			});
		}
	}

	if (reportPath) {
		logger.info('');
		printReportSuccess(reportPath, {
			useColor: options.color === false ? false : undefined,
		});
	}
}
