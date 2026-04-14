import { loadConfig } from '../../config/ConfigLoader';

import type { CliOptions } from '../types';

export function loadWorkflowConfig(
	entry: string | undefined,
	options: CliOptions
) {
	return loadConfig({
		entry,
		output: options.output,
		root: options.root,
		luaVersion: options.luaVersion,
		config: options.config,
		missing: options.missing,
		fallback: options.fallback,
	});
}

export function loadAnalyzeConfig(
	entry: string | undefined,
	options: CliOptions
) {
	return loadConfig({
		entry,
		root: options.root,
		luaVersion: options.luaVersion,
		config: options.config,
		missing: options.missing,
		fallback: options.fallback,
	});
}

export function resolveAnalyzeFormat(options: CliOptions): 'text' | 'json' {
	return options.format ?? 'text';
}

export function resolveBundleReportFormat(
	options: CliOptions
): 'text' | 'json' | undefined {
	return options.reportFormat ?? 'text';
}
