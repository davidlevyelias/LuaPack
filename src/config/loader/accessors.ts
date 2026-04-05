import { LOADER_INTERNALS, type LoaderInternals } from './internals';
import type { LoadedConfig, V2Config } from './types';

type WorkflowConfigLike = V2Config & {
	[LOADER_INTERNALS]?: LoaderInternals;
};

function ensureInternals(config: WorkflowConfigLike): LoaderInternals {
	if (!config[LOADER_INTERNALS]) {
		config[LOADER_INTERNALS] = {
			analyzeOnly: false,
		};
	}

	return config[LOADER_INTERNALS]!;
}

export function getNormalizedV2Config(config: WorkflowConfigLike): V2Config | null {
	return config ?? null;
}

export function isAnalyzeOnlyConfig(config: WorkflowConfigLike): boolean {
	return Boolean(config[LOADER_INTERNALS]?.analyzeOnly);
}

export function setAnalyzeOnlyConfig(
	config: LoadedConfig,
	analyzeOnly: boolean
	): LoadedConfig {
	ensureInternals(config).analyzeOnly = analyzeOnly;
	return config;
}

export function setConfigVersion(
	config: LoadedConfig,
	configVersion: LoaderInternals['configVersion']
	): LoadedConfig {
	ensureInternals(config).configVersion = configVersion;
	return config;
}