import type { FallbackMode } from '../config/loader/types';

export interface BundledModule {
	moduleName: string;
	packageName: string;
	filePath: string;
	content: string;
}

export interface BundleRuntimePolicies {
	externalModules: string[];
	ignoredModules: string[];
}

export interface BundlePlan {
	entryModuleName: string;
	entryPackageName: string;
	packagePrefixes: string[];
	bundledModules: BundledModule[];
	externalModules: string[];
	ignoredModules: string[];
	packageDependencyModes: Record<
		string,
		Record<string, 'bundle' | 'external' | 'ignore'>
	>;
	fallbackPolicy: FallbackMode;
}
