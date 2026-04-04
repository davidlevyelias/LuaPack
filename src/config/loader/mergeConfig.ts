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
	const cliRoots = Array.isArray(cliOptions.root)
		? cliOptions.root.map((rootPath) => path.resolve(process.cwd(), rootPath))
		: undefined;
	const cliEnvVars = cliOptions.envVar !== undefined
		? cliOptions.envVar
		: Array.isArray(cliOptions.env)
			? cliOptions.env
			: undefined;
	const cliMissingPolicy = cliOptions.missing;

	if (cliOptions.entry) {
		merged.entry = cliOptions.entry;
	}

	if (cliOptions.output) {
		merged.output = cliOptions.output;
	}

	if (configVersion === 'v2') {
		if (cliRoots && cliRoots.length > 0) {
			merged.modules = {
				...(merged.modules || {}),
				roots: cliRoots,
			};
		} else if (cliOptions.sourceroot) {
			const cliRoot = path.resolve(process.cwd(), cliOptions.sourceroot);
			merged.modules = {
				...(merged.modules || {}),
				roots: [cliRoot],
			};
		}

		if (cliMissingPolicy) {
			merged.modules = {
				...(merged.modules || {}),
				missing: cliMissingPolicy,
			};
		} else if (typeof cliOptions.ignoreMissing === 'boolean') {
			merged.modules = {
				...(merged.modules || {}),
				missing: cliOptions.ignoreMissing ? 'warn' : 'error',
			};
		}

		if (cliEnvVars !== undefined) {
			merged.modules = {
				...(merged.modules || {}),
				env: cliEnvVars,
			};
		}

		return merged;
	}

	if (cliRoots && cliRoots.length > 0) {
		merged.sourceRoot = cliRoots[0];
		merged.modules = {
			...(merged.modules || {}),
			external: {
				...((merged.modules && merged.modules.external) || {}),
				paths: cliRoots.slice(1),
			},
		};
	} else if (cliOptions.sourceroot) {
		merged.sourceRoot = cliOptions.sourceroot;
	}

	if (cliMissingPolicy) {
		merged.modules = {
			...(merged.modules || {}),
			ignoreMissing: cliMissingPolicy !== 'error',
		};
	} else if (typeof cliOptions.ignoreMissing === 'boolean') {
		merged.modules = {
			...(merged.modules || {}),
			ignoreMissing: cliOptions.ignoreMissing,
		};
	}

	if (cliEnvVars !== undefined) {
		merged.modules = {
			...(merged.modules || {}),
			external: {
				...((merged.modules && merged.modules.external) || {}),
				env: cliEnvVars,
			},
		};
	}

	return merged;
}
