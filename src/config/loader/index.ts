export { readConfigFile, detectConfigVersion } from './configFile';
export { getValidator } from './schemaValidator';
export { hasObfuscationCliToggles, mergeConfig } from './mergeConfig';
export { normalizePathsV1, normalizePathsV2 } from './pathNormalization';
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
