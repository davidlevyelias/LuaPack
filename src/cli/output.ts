import colors from 'ansi-colors';

import logger from '../Logger';

export function printCliHeader({
	analyzeOnly,
	packageVersion,
}: {
	analyzeOnly: boolean;
	packageVersion: string;
}) {
	const title = colors.bgBlue.white.bold(` LuaPack v${packageVersion} `);
	const modeLabel = analyzeOnly
		? colors.bgMagenta.white.bold(' ANALYSIS MODE ')
		: null;
	const headerLine = [title, modeLabel].filter(Boolean).join(' ');
	logger.info('');
	logger.info(headerLine);
	logger.info('');
}

export function printBundleSuccess(bundlePath: string) {
	const label = colors.green('Bundle successfully created at:');
	const formattedPath = colors.bold.underline(bundlePath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

export function printReportSuccess(reportPath: string) {
	const label = colors.green('Analysis report saved to:');
	const formattedPath = colors.bold.underline(reportPath);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}