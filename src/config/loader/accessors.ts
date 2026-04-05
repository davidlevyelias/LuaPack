import { LOADER_INTERNALS, type LoaderInternals } from './internals';
import type { LegacyFacadeOutput, V2Config } from './types';

type WorkflowConfigLike = {
	[LOADER_INTERNALS]?: LoaderInternals;
	_v2?: V2Config;
	_analyzeOnly?: boolean;
};

export function getNormalizedV2Config(config: WorkflowConfigLike): V2Config | null {
	return config[LOADER_INTERNALS]?.normalizedV2 ?? config._v2 ?? null;
}

export function isAnalyzeOnlyConfig(config: WorkflowConfigLike): boolean {
	return Boolean(config[LOADER_INTERNALS]?.analyzeOnly ?? config._analyzeOnly);
}

export function setAnalyzeOnlyConfig(
	config: LegacyFacadeOutput,
	analyzeOnly: boolean
): LegacyFacadeOutput {
	if (config[LOADER_INTERNALS]) {
		config[LOADER_INTERNALS]!.analyzeOnly = analyzeOnly;
	}
	config._analyzeOnly = analyzeOnly;
	return config;
}

export function setConfigWarnings(
	config: LegacyFacadeOutput,
	warnings: string[]
): LegacyFacadeOutput {
	if (config[LOADER_INTERNALS]) {
		config[LOADER_INTERNALS]!.warnings = [...warnings];
	}
	config._warnings = [...warnings];
	return config;
}

export function getConfigWarnings(config: WorkflowConfigLike & { _warnings?: string[] }): string[] {
	return config[LOADER_INTERNALS]?.warnings ?? config._warnings ?? [];
}

export function setConfigVersion(
	config: LegacyFacadeOutput,
	configVersion: LoaderInternals['configVersion']
): LegacyFacadeOutput {
	if (config[LOADER_INTERNALS]) {
		config[LOADER_INTERNALS]!.configVersion = configVersion;
	}
	config._configVersion = configVersion;
	return config;
}