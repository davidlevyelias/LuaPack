import type { ConfigVersion, V2Config } from './types';

export const LOADER_INTERNALS = Symbol('luapack.loaderInternals');

export interface LoaderInternals {
	normalizedV2: V2Config;
	analyzeOnly: boolean;
	warnings: string[];
	configVersion?: ConfigVersion;
}