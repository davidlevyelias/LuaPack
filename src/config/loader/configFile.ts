import fs from 'fs';
import path from 'path';

import type { ConfigVersion, RawConfig } from './types';

export function readConfigFile(configPath: string): {
	config: RawConfig;
	baseDir: string;
} {
	const resolvedPath = path.resolve(configPath);
	if (!fs.existsSync(resolvedPath)) {
		throw Object.assign(
			new Error(`Config file not found at ${resolvedPath}`),
			{
				code: 'CONFIG_NOT_FOUND',
				errorType: 'config',
			}
		);
	}

	let parsed: RawConfig;
	try {
		const raw = fs.readFileSync(resolvedPath, 'utf-8');
		parsed = JSON.parse(raw) as RawConfig;
	} catch (error) {
		throw Object.assign(
			new Error(
				`Failed to read config file '${resolvedPath}': ${(error as Error).message}`
			),
			{
				code: 'CONFIG_READ_FAILED',
				errorType: 'config',
			}
		);
	}

	return { config: parsed, baseDir: path.dirname(resolvedPath) };
}

export function detectConfigVersion(config: RawConfig): ConfigVersion {
	if (
		config &&
		typeof config === 'object' &&
		Number(config.schemaVersion) === 2
	) {
		return 'v2';
	}
	throw Object.assign(
		new Error(
			'LuaPack v1 configuration is no longer supported. Add schemaVersion: 2 and migrate the config to the v2 schema.'
		),
		{
			code: 'CONFIG_VERSION_UNSUPPORTED',
			errorType: 'config',
		}
	);
}
