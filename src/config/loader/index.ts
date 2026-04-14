export { readConfigFile, detectConfigVersion } from './configFile';
export { LOADER_INTERNALS } from './internals';
export { getValidator } from './schemaValidator';
export {
	getNormalizedV2Config,
	getConfigWarnings,
	isAnalyzeOnlyConfig,
	setAnalyzeOnlyConfig,
	setConfigWarnings,
	setConfigVersion,
} from './accessors';
export { mergeConfig } from './mergeConfig';
export { normalizePaths } from './pathNormalization';
export { collectConfigWarnings, normalizeToV2Config } from './v2Normalization';
export { validateConfig } from './validation';
export type {
	ConfigVersion,
	CliOptions,
	LoadedConfig,
	RawConfig,
	V2Config,
	V2Packages,
	V2Package,
	V2Bundle,
	V2Internal,
	NormalizedRule,
	NormalizedDependencyPolicy,
	MissingPolicy,
	LuaVersion,
	FallbackMode,
	RuleMode,
	EntryKind,
	RawPackage,
	RawPackages,
	RawDependencyPolicy,
} from './types';
export type { LoaderInternals } from './internals';
