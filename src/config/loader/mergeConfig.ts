import path from 'path';

import type { CliOptions, ConfigVersion, RawConfig } from './types';

export function mergeConfig(
	baseConfig: RawConfig,
	cliOptions: CliOptions,
	configVersion: ConfigVersion
): RawConfig {
	void configVersion;
	const merged: RawConfig = { ...baseConfig, schemaVersion: 2 };
	const cliRoots = Array.isArray(cliOptions.root)
		? cliOptions.root.map((rootPath) => path.resolve(process.cwd(), rootPath))
		: undefined;
	const cliEnvVars = cliOptions.envVar;
	const cliMissingPolicy = cliOptions.missing;

	if (cliOptions.entry) {
		merged.entry = cliOptions.entry;
	}

	if (cliOptions.output) {
		merged.output = cliOptions.output;
	}

	if (cliRoots && cliRoots.length > 0) {
		merged.modules = {
			...(merged.modules || {}),
			roots: cliRoots,
		};
	}

	if (cliMissingPolicy) {
		merged.modules = {
			...(merged.modules || {}),
			missing: cliMissingPolicy,
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
