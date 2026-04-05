import type { ConfigVersion } from './types';

export const LOADER_INTERNALS = Symbol('luapack.loaderInternals');

export interface LoaderInternals {
	analyzeOnly: boolean;
	warnings: string[];
	configVersion?: ConfigVersion;
}