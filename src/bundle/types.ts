import type { FallbackMode } from '../config/loader/types';

export interface BundledModule {
	moduleName: string;
	packageName: string;
	filePath: string;
	content: string;
}

export interface BundlePlan {
	entryModuleName: string;
	entryPackageName: string;
	packagePrefixes: string[];
	bundledModules: BundledModule[];
	externalModules: string[];
	ignoredModules: string[];
	aliases: string[];
	fallbackPolicy: FallbackMode;
}
