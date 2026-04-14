import path from 'path';

import type { CliOptions, ConfigVersion, RawConfig } from './types';

export function mergeConfig(
	baseConfig: RawConfig,
	cliOptions: CliOptions,
	configVersion: ConfigVersion
): RawConfig {
	void configVersion;
	const merged: RawConfig = { ...baseConfig, schemaVersion: 2 };
	const cliRoot =
		typeof cliOptions.root === 'string' && cliOptions.root.length > 0
			? path.resolve(process.cwd(), cliOptions.root)
			: undefined;
	const cliMissingPolicy = cliOptions.missing;

	if (cliOptions.entry) {
		merged.entry = cliOptions.entry;
	}

	if (cliOptions.output) {
		merged.output = cliOptions.output;
	}

	if (cliOptions.luaVersion) {
		merged.luaVersion = cliOptions.luaVersion;
	}

	if (cliRoot) {
		merged.packages = {
			...(merged.packages || {}),
			default: {
				...(merged.packages?.default || {}),
				root: cliRoot,
			},
		};
	}

	if (cliMissingPolicy) {
		merged.missing = cliMissingPolicy;
	}

	return merged;
}
