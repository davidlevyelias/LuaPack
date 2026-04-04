import logger from '../Logger';

import type { CliOptions, CommandName } from './types';
import { runAnalyzeWorkflow, runBundleWorkflow } from './workflows';

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
