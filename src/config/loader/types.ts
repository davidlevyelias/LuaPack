export type ConfigVersion = 'v2';

import type { LOADER_INTERNALS, LoaderInternals } from './internals';

export type MissingPolicy = 'error' | 'warn';
export type FallbackMode = 'never' | 'external-only' | 'always';
export type RuleMode = 'bundle' | 'external' | 'ignore';
export type EntryKind = 'package-module' | 'bootstrap';

export interface NormalizedRule {
	mode: RuleMode;
	path?: string;
	recursive?: boolean;
}

export interface NormalizedDependencyPolicy {
	mode: RuleMode;
	recursive?: boolean;
}

export interface V2Package {
	root: string;
	dependencies: Record<string, NormalizedDependencyPolicy>;
	rules: Record<string, NormalizedRule>;
}

export type V2Packages = Record<string, V2Package>;

export interface V2Bundle {
	fallback: FallbackMode;
}

export interface V2Internal {
	entryPackage: string;
	entryKind: EntryKind;
}

export interface V2Config {
	schemaVersion: 2;
	entry: string;
	output: string;
	missing: MissingPolicy;
	packages: V2Packages;
	bundle: V2Bundle;
	_internal: V2Internal;
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
	fallback?: FallbackMode;
	[key: string]: unknown;
}

export interface RawDependencyPolicy {
	mode?: string;
	recursive?: boolean;
	path?: string;
}

export interface RawPackage {
	root?: string;
	dependencies?: Record<string, RawDependencyPolicy | undefined>;
	rules?: Record<
		string,
		{ mode?: string; path?: string; recursive?: boolean } | undefined
	>;
}

export type RawPackages = Record<string, RawPackage | undefined>;

/** Raw canonical v2 config as read from file or merged with CLI options. */
export interface RawConfig {
	schemaVersion: 2;
	entry?: string;
	output?: string;
	missing?: string;
	packages?: RawPackages;
	bundle?: {
		fallback?: string;
	};
}
