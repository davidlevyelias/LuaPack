export type ConfigVersion = 'v2';

import type { LOADER_INTERNALS, LoaderInternals } from './internals';

export type MissingPolicy = 'error' | 'warn' | 'ignore';
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

export interface LoadedConfig extends V2Config {
	[LOADER_INTERNALS]?: LoaderInternals;
}

export interface CliOptions {
	config?: string;
	entry?: string;
	output?: string;
	root?: string[];
	missing?: MissingPolicy;
	envVar?: string[];
	fallback?: FallbackMode;
	[key: string]: unknown;
}

/** Raw modules block shared between v1 and v2 file shapes. All fields optional. */
export interface RawModules {
	missing?: string;
	roots?: string[];
	env?: string[];
	rules?: Record<
		string,
		{ mode?: string; path?: string; recursive?: boolean } | undefined
	>;
}

/** Raw canonical v2 config as read from file or merged with CLI options. */
export interface RawConfig {
	schemaVersion: 2;
	entry?: string;
	output?: string;
	modules?: RawModules;
	bundle?: {
		fallback?: string;
	};
}
