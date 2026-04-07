import colors from 'ansi-colors';
import type { V2Config } from '../config/loader/types';

import logger from '../Logger';

function applyColor(
	useColor: boolean,
	formatter: (value: string) => string,
	value: string
): string {
	return useColor ? formatter(value) : value;
}

export function printCliHeader({
	analyzeOnly,
	packageVersion,
	useColor = true,
}: {
	analyzeOnly: boolean;
	packageVersion: string;
	useColor?: boolean;
}) {
	const title = applyColor(
		useColor,
		colors.bgBlue.white.bold,
		` LuaPack v${packageVersion} `
	);
	const modeLabel = analyzeOnly
		? applyColor(useColor, colors.bgMagenta.white.bold, ' ANALYSIS MODE ')
		: null;
	const headerLine = [title, modeLabel].filter(Boolean).join(' ');
	logger.info('');
	logger.info(headerLine);
	logger.info('');
}

export function printBundleSuccess(
	bundlePath: string,
	{ useColor = true }: { useColor?: boolean } = {}
) {
	const label = applyColor(
		useColor,
		colors.green,
		'Bundle successfully created at:'
	);
	const formattedPath = applyColor(
		useColor,
		colors.bold.underline,
		bundlePath
	);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

export function printReportSuccess(
	reportPath: string,
	{ useColor = true }: { useColor?: boolean } = {}
) {
	const label = applyColor(
		useColor,
		colors.green,
		'Analysis report saved to:'
	);
	const formattedPath = applyColor(
		useColor,
		colors.bold.underline,
		reportPath
	);
	logger.info('');
	logger.info(`${label} ${formattedPath}`);
}

export function printConfigSnapshot(config: V2Config | null) {
	process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
}

export function printJsonErrorPayload(payload: {
	type: 'command-error';
	status: 'error';
	command: 'analyze' | 'bundle';
	error: {
		type: 'usage' | 'config' | 'runtime';
		code: string;
		message: string;
		details?: string[];
	};
}) {
	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
