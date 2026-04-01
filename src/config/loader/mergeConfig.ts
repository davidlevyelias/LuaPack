import path from 'path';

import type { CliOptions, ConfigVersion, RawConfig } from './types';

export function hasObfuscationCliToggles(cliOptions: CliOptions): boolean {
	return (['renameVariables', 'minify', 'ascii'] as const).some(
		(key) => typeof cliOptions[key] === 'boolean'
	);
}

export function mergeConfig(
	baseConfig: RawConfig,
	cliOptions: CliOptions,
	configVersion: ConfigVersion
): RawConfig {
	const merged: RawConfig = { ...baseConfig };

	if (cliOptions.entry) {
		merged.entry = cliOptions.entry;
	}

	if (cliOptions.output) {
		merged.output = cliOptions.output;
	}

	if (configVersion === 'v2') {
		if (cliOptions.sourceroot) {
			const cliRoot = path.resolve(process.cwd(), cliOptions.sourceroot);
			const existingRoots = Array.isArray(merged.modules?.roots)
				? merged.modules!.roots!
				: [];
			merged.modules = {
				...(merged.modules || {}),
				roots: [cliRoot, ...existingRoots.filter((value) => value !== cliRoot)],
			};
		}

		if (typeof cliOptions.ignoreMissing === 'boolean') {
			merged.modules = {
				...(merged.modules || {}),
				missing: cliOptions.ignoreMissing ? 'warn' : 'error',
			};
		}

		if (cliOptions.env !== undefined) {
			const envValues = Array.isArray(cliOptions.env) ? cliOptions.env : [];
			merged.modules = {
				...(merged.modules || {}),
				env: envValues,
			};
		}

		return merged;
	}

	if (cliOptions.sourceroot) {
		merged.sourceRoot = cliOptions.sourceroot;
	}

	if (typeof cliOptions.ignoreMissing === 'boolean') {
		merged.modules = {
			...(merged.modules || {}),
			ignoreMissing: cliOptions.ignoreMissing,
		};
	}

	if (cliOptions.env !== undefined) {
		const envValues = Array.isArray(cliOptions.env) ? cliOptions.env : [];
		merged.modules = {
			...(merged.modules || {}),
			external: {
				...((merged.modules && merged.modules.external) || {}),
				env: envValues,
			},
		};
	}

	return merged;
}
