import fs from 'fs';
import path from 'path';

import type { ConfigVersion, RawConfig } from './types';

export function readConfigFile(configPath: string): { config: RawConfig; baseDir: string } {
	const resolvedPath = path.resolve(configPath);
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Config file not found at ${resolvedPath}`);
	}

	let parsed: RawConfig;
	try {
		const raw = fs.readFileSync(resolvedPath, 'utf-8');
		parsed = JSON.parse(raw) as RawConfig;
	} catch (error) {
		throw new Error(
			`Failed to read config file '${resolvedPath}': ${(error as Error).message}`
		);
	}

	return { config: parsed, baseDir: path.dirname(resolvedPath) };
}

export function detectConfigVersion(config: RawConfig): ConfigVersion {
	if (config && typeof config === 'object' && Number(config.schemaVersion) === 2) {
		return 'v2';
	}
	return 'v1';
}
