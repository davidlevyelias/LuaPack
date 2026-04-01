export type ConfigVersion = 'v1' | 'v2';

export type MissingPolicy = 'error' | 'warn' | 'ignore';
export type BundleMode = 'runtime' | 'typed';
export type FallbackMode = 'never' | 'external-only' | 'always';
export type RuleMode = 'bundle' | 'external' | 'ignore';

export interface NormalizedRule {
	mode: RuleMode;
	path?: string;
	recursive?: boolean;
}

export interface V2Modules {
	roots: string[];
	env: string[];
	missing: MissingPolicy;
	rules: Record<string, NormalizedRule>;
}

export interface V2Bundle {
	mode: BundleMode;
	fallback: FallbackMode;
}

export interface V2Compat {
	externalRecursive: boolean;
}

export interface V2Config {
	schemaVersion: 2;
	entry: string;
	output: string;
	modules: V2Modules;
	bundle: V2Bundle;
	_compat: V2Compat;
}

export interface CliOptions {
	config?: string;
	entry?: string;
	output?: string;
	sourceroot?: string;
	renameVariables?: boolean;
	minify?: boolean;
	ascii?: boolean;
	ignoreMissing?: boolean;
	env?: string | string[];
	onWarning?: (message: string) => void;
	[key: string]: unknown;
}

export interface LegacyExternalConfig {
	enabled: boolean;
	recursive: boolean;
	paths: string[];
	env: string[];
}

export interface LegacyModulesConfig {
	ignoreMissing: boolean;
	ignore: string[];
	external: LegacyExternalConfig;
	overrides: Record<string, { path?: string; recursive?: boolean }>;
}

export interface LegacyFacadeOutput {
	schemaVersion: 2;
	entry: string;
	output: string;
	_analyzeOnly: boolean;
	sourceRoot: string;
	modules: LegacyModulesConfig;
	bundle: V2Bundle;
	_v2: V2Config;
	_warnings?: string[];
	_configVersion?: ConfigVersion;
}

/** Raw modules block shared between v1 and v2 file shapes. All fields optional. */
export interface RawModules {
	ignoreMissing?: boolean;
	ignore?: string[];
	missing?: string;
	roots?: string[];
	env?: string[];
	external?: {
		enabled?: boolean;
		recursive?: boolean;
		paths?: string[];
		env?: string[];
	};
	overrides?: Record<string, { path?: string; recursive?: boolean } | undefined>;
	rules?: Record<string, { mode?: string; path?: string; recursive?: boolean } | undefined>;
}

/** Raw config as read from file or merged with CLI options (v1 or v2 shape). */
export interface RawConfig {
	schemaVersion?: number;
	entry?: string;
	output?: string;
	sourceRoot?: string;
	modules?: RawModules;
	obfuscation?: unknown;
	bundle?: {
		mode?: string;
		fallback?: string;
	};
}
