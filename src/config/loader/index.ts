export { readConfigFile, detectConfigVersion } from './configFile';
export { LOADER_INTERNALS } from './internals';
export { getValidator } from './schemaValidator';
export {
	getConfigWarnings,
	getNormalizedV2Config,
	isAnalyzeOnlyConfig,
	setAnalyzeOnlyConfig,
	setConfigVersion,
	setConfigWarnings,
} from './accessors';
export { hasObfuscationCliToggles, mergeConfig } from './mergeConfig';
export { normalizePaths } from './pathNormalization';
export { normalizeToV2Config } from './v2Normalization';
export { buildLegacyFacade } from './legacyFacade';
export { collectWarnings, emitWarning } from './warnings';
export { validateConfig } from './validation';
export type {
	ConfigVersion,
	CliOptions,
	RawConfig,
	RawModules,
	V2Config,
	V2Modules,
	V2Bundle,
	V2Compat,
	NormalizedRule,
	MissingPolicy,
	BundleMode,
	FallbackMode,
	RuleMode,
	LegacyFacadeOutput,
	LegacyModulesConfig,
	LegacyExternalConfig,
} from './types';
export type { LoaderInternals } from './internals';
