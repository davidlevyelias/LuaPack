import fs from 'fs';
import path from 'path';

import type { ModuleRecord, WorkflowConfig } from '../analysis/types';
import type {
	MissingPolicy,
	NormalizedDependencyPolicy,
	NormalizedRule,
	V2Package,
} from '../config/loader/types';

interface ResolvedRequest {
	packageName: string;
	localModuleId: string;
	runtimeModuleName: string;
}

interface ResolvedPolicy {
	mode: NormalizedRule['mode'];
	recursive: boolean;
	path?: string;
	overrideApplied: boolean;
	isExternal: boolean;
}

export default class ModuleResolver {
	private readonly defaultPackageName = 'default';
	private readonly packages: Record<string, V2Package>;
	private readonly packageNamesByLength: string[];
	private readonly legacyRoots: string[];
	private readonly missingPolicy: MissingPolicy;
	private readonly externalRecursiveDefault: boolean;
	readonly ignoreMissing: boolean;

	constructor(config: WorkflowConfig) {
		this.packages = this.buildPackageMap(config);
		this.packageNamesByLength = Object.keys(this.packages).sort(
			(a, b) => b.length - a.length
		);
		this.legacyRoots = this.computeLegacyRoots(config);
		this.missingPolicy = config.modules?.missing ?? 'error';
		this.ignoreMissing = this.missingPolicy !== 'error';
		this.externalRecursiveDefault =
			typeof config._compat?.externalRecursive === 'boolean'
				? config._compat.externalRecursive
				: true;
	}

	normalizeModuleId(moduleId = ''): string {
		return moduleId.replace(/\\/g, '/');
	}

	normalizePath(targetPath = ''): string {
		return targetPath.replace(/\\/g, '/');
	}

	resolve(requirePath: string, currentModule: ModuleRecord): ModuleRecord {
		const moduleId = this.normalizeModuleId(requirePath);
		const currentPackageName = currentModule.packageName || this.defaultPackageName;
		const request = this.resolveRequest(currentPackageName, moduleId);
		const policy = this.resolvePolicy(currentPackageName, request);

		if (policy.mode === 'ignore') {
			return this.createIgnoredRecord(request);
		}

		if (policy.path) {
			const packageConfig = this.getPackageConfig(request.packageName);
			const overrideCandidate = this.resolveRulePath(
				policy.path,
				packageConfig.root
			);
			const resolvedPath = this.tryPath(overrideCandidate);
			if (!resolvedPath) {
				const overrideError = Object.assign(
					new Error(
						`Override path for module '${moduleId}' not found: ${this.normalizePath(policy.path)}`
					),
					{ code: 'MODULE_OVERRIDE_NOT_FOUND' }
				);

				if (this.ignoreMissing) {
					return this.createMissingRecord(request, {
						isExternal: policy.isExternal,
						overrideApplied: true,
						error: overrideError,
						filePath: this.buildSyntheticOverridePath(overrideCandidate),
					});
				}

				throw overrideError;
			}

			return this.createRecord({
				request,
				filePath: resolvedPath,
				overrideApplied: true,
				policy,
			});
		}

		const currentDir = currentModule.filePath
			? path.dirname(currentModule.filePath)
			: this.getPackageConfig(currentPackageName).root;
		const candidates = this.computeCandidates(
			request,
			currentPackageName,
			currentDir
		);

		for (const candidate of candidates) {
			const resolvedPath = this.tryPath(candidate);
			if (resolvedPath) {
				return this.createRecord({
					request,
					filePath: resolvedPath,
					policy,
				});
			}
		}

		if (this.ignoreMissing) {
			return this.createMissingRecord(request, {
				isExternal: policy.isExternal,
				overrideApplied: policy.overrideApplied,
			});
		}

		const error = Object.assign(
			new Error(`Module not found: ${moduleId}`),
			{
				code: 'MODULE_NOT_FOUND',
				moduleId,
				requester: currentDir,
				requestPackage: request.packageName,
			}
		);
		throw error;
	}

	createEntryRecord(filePath: string): ModuleRecord {
		const packageConfig = this.getPackageConfig(this.defaultPackageName);
		const fallbackLocal = path.basename(filePath, '.lua');
		const localModuleId = this.deriveLocalModuleId(
			filePath,
			packageConfig.root,
			fallbackLocal
		);
		const request: ResolvedRequest = {
			packageName: this.defaultPackageName,
			localModuleId,
			runtimeModuleName: this.toRuntimeModuleName(
				this.defaultPackageName,
				localModuleId
			),
		};
		return this.createRecord({
			request,
			filePath,
			overrideApplied: false,
			policy: {
				mode: 'bundle',
				recursive: true,
				overrideApplied: false,
				isExternal: false,
			},
		});
	}

	createMissingRecordForRequire(
		currentModule: ModuleRecord,
		requireId: string,
		error?: Error | null
	): ModuleRecord {
		const request = this.resolveRequest(
			currentModule.packageName || this.defaultPackageName,
			this.normalizeModuleId(requireId)
		);
		const policy = this.resolvePolicy(
			currentModule.packageName || this.defaultPackageName,
			request
		);
		return this.createMissingRecord(request, {
			isExternal: policy.isExternal,
			error: error ?? null,
			overrideApplied: policy.overrideApplied,
		});
	}

	private resolveRulePath(overridePath: string, packageRoot: string): string {
		const candidate = overridePath.replace(/\.lua$/, '');
		if (path.isAbsolute(candidate)) {
			return candidate;
		}
		return path.resolve(packageRoot, candidate);
	}

	private createIgnoredRecord(request: ResolvedRequest): ModuleRecord {
		const canonicalModuleId = this.toCanonicalId(
			request.packageName,
			request.localModuleId
		);
		return {
			id: canonicalModuleId,
			canonicalModuleId,
			moduleName: request.runtimeModuleName,
			packageName: request.packageName,
			localModuleId: request.localModuleId,
			filePath: null,
			isIgnored: true,
			isMissing: false,
			isExternal: false,
			overrideApplied: false,
			analyzeDependencies: false,
		};
	}

	createMissingRecord(
		request: ResolvedRequest,
		{
			isExternal = false,
			overrideApplied = false,
			error = null,
			filePath = null,
		}: {
			isExternal?: boolean;
			overrideApplied?: boolean;
			error?: Error | null;
			filePath?: string | null;
		} = {}
	): ModuleRecord {
		const canonicalModuleId = this.toCanonicalId(
			request.packageName,
			request.localModuleId
		);
		return {
			id: canonicalModuleId,
			canonicalModuleId,
			moduleName: request.runtimeModuleName,
			packageName: request.packageName,
			localModuleId: request.localModuleId,
			filePath,
			isIgnored: false,
			isMissing: true,
			isExternal,
			overrideApplied: Boolean(overrideApplied),
			analyzeDependencies: false,
			missingError: error,
		};
	}

	private buildSyntheticOverridePath(basePath: string | null): string | null {
		if (!basePath) {
			return null;
		}
		const normalized = basePath.replace(/[\\/]+$/, '');
		if (normalized.endsWith('.lua')) {
			return normalized;
		}
		return `${normalized}.lua`;
	}

	private createRecord({
		request,
		filePath,
		overrideApplied = false,
		policy,
	}: {
		request: ResolvedRequest;
		filePath: string;
		overrideApplied?: boolean;
		policy: ResolvedPolicy;
	}): ModuleRecord {
		const packageConfig = this.getPackageConfig(request.packageName);
		const localModuleId = this.deriveLocalModuleId(
			filePath,
			packageConfig.root,
			request.localModuleId
		);
		const canonicalModuleId = this.toCanonicalId(
			request.packageName,
			localModuleId
		);
		const moduleName = this.toRuntimeModuleName(
			request.packageName,
			localModuleId
		);

		return {
			id: canonicalModuleId,
			canonicalModuleId,
			moduleName,
			packageName: request.packageName,
			localModuleId,
			filePath,
			isIgnored: false,
			isMissing: false,
			isExternal: policy.isExternal,
			overrideApplied: overrideApplied || policy.overrideApplied,
			analyzeDependencies: policy.recursive,
		};
	}

	private buildPackageMap(config: WorkflowConfig): Record<string, V2Package> {
		const packages: Record<string, V2Package> = {
			...(config.packages || {}),
		};

		const defaultRoot =
			typeof packages.default?.root === 'string' && packages.default.root
				? packages.default.root
				: Array.isArray(config.modules?.roots) &&
				  config.modules.roots.length > 0
					? config.modules.roots[0]
					: path.dirname(config.entry);
		const defaultPackage = packages.default || {
			root: defaultRoot,
			dependencies: {},
			rules: {},
		};

		packages.default = {
			root: defaultPackage.root,
			dependencies: { ...(defaultPackage.dependencies || {}) },
			rules: {
				...(config.modules?.rules || {}),
				...(defaultPackage.rules || {}),
			},
		};

		for (const [packageName, packageConfig] of Object.entries(packages)) {
			packages[packageName] = {
				root: packageConfig.root,
				dependencies: { ...(packageConfig.dependencies || {}) },
				rules: { ...(packageConfig.rules || {}) },
			};
		}

		return packages;
	}

	private computeLegacyRoots(config: WorkflowConfig): string[] {
		const roots =
			Array.isArray(config.modules?.roots) && config.modules.roots.length > 0
				? config.modules.roots
				: [this.getPackageConfig(this.defaultPackageName).root];

		const unique = new Set<string>();
		for (const rootPath of roots) {
			const absolute = path.isAbsolute(rootPath)
				? rootPath
				: path.resolve(this.getPackageConfig(this.defaultPackageName).root, rootPath);
			unique.add(absolute);
		}
		return Array.from(unique);
	}

	private resolveRequest(
		currentPackageName: string,
		requireId: string
	): ResolvedRequest {
		const matchedPackage = this.matchPackagePrefix(requireId);
		if (matchedPackage) {
			const localModuleId =
				requireId === matchedPackage
					? 'init'
					: requireId.slice(matchedPackage.length + 1);
			return {
				packageName: matchedPackage,
				localModuleId,
				runtimeModuleName: this.toRuntimeModuleName(
					matchedPackage,
					localModuleId
				),
			};
		}

		return {
			packageName: currentPackageName,
			localModuleId: requireId,
			runtimeModuleName: this.toRuntimeModuleName(
				currentPackageName,
				requireId
			),
		};
	}

	private resolvePolicy(
		currentPackageName: string,
		request: ResolvedRequest
	): ResolvedPolicy {
		const targetPackage = this.getPackageConfig(request.packageName);
		const currentPackage = this.getPackageConfig(currentPackageName);
		const dependencyPolicy: NormalizedDependencyPolicy | undefined =
			currentPackageName === request.packageName
				? undefined
				: currentPackage.dependencies[request.packageName];
		const localRule: NormalizedRule =
			targetPackage.rules[request.localModuleId] || { mode: 'bundle' };
		const mode = dependencyPolicy?.mode || localRule.mode;
		const isExternal = mode === 'external';
		const recursive =
			typeof dependencyPolicy?.recursive === 'boolean'
				? dependencyPolicy.recursive
				: typeof localRule.recursive === 'boolean'
					? localRule.recursive
					: isExternal
						? this.externalRecursiveDefault
						: true;

		return {
			mode,
			recursive,
			path: dependencyPolicy ? undefined : localRule.path,
			overrideApplied: Boolean(!dependencyPolicy && localRule.path),
			isExternal,
		};
	}

	private computeCandidates(
		request: ResolvedRequest,
		currentPackageName: string,
		currentDir: string
	): string[] {
		const candidates: string[] = [];
		const seen = new Set<string>();
		const packageConfig = this.getPackageConfig(request.packageName);
		const pathFromRequire = request.localModuleId.replace(/\./g, path.sep);
		const pushCandidate = (basePath: string) => {
			if (!seen.has(basePath)) {
				seen.add(basePath);
				candidates.push(basePath);
			}
		};

		if (request.packageName === currentPackageName) {
			pushCandidate(path.resolve(currentDir, pathFromRequire));
		}

		pushCandidate(path.resolve(packageConfig.root, pathFromRequire));

		if (request.packageName === this.defaultPackageName) {
			for (const root of this.legacyRoots) {
				pushCandidate(path.resolve(root, pathFromRequire));
			}
		}

		return candidates;
	}

	private getPackageConfig(packageName: string): V2Package {
		const config = this.packages[packageName];
		if (config) {
			return config;
		}
		return this.packages[this.defaultPackageName];
	}

	private matchPackagePrefix(moduleId: string): string | null {
		for (const packageName of this.packageNamesByLength) {
			if (moduleId === packageName) {
				return packageName;
			}
			if (moduleId.startsWith(`${packageName}.`)) {
				return packageName;
			}
		}
		return null;
	}

	private toCanonicalId(packageName: string, localModuleId: string): string {
		return `@${packageName}/${localModuleId}`;
	}

	private toRuntimeModuleName(packageName: string, localModuleId: string): string {
		if (packageName === this.defaultPackageName) {
			return localModuleId;
		}
		if (localModuleId === 'init') {
			return packageName;
		}
		return `${packageName}.${localModuleId}`;
	}

	private deriveLocalModuleId(
		filePath: string,
		packageRoot: string,
		fallbackLocalId: string
	): string {
		if (filePath && this.isWithinRoot(filePath, packageRoot)) {
			const relativePath = path
				.relative(packageRoot, filePath)
				.replace(/\\/g, '/');
			const withoutExtension = relativePath.replace(/\.lua$/, '');
			if (withoutExtension.endsWith('/init')) {
				const parentPath = withoutExtension.slice(0, -5);
				if (parentPath.length === 0) {
					return 'init';
				}
				return parentPath.replace(/\//g, '.');
			}
			return withoutExtension.replace(/\//g, '.');
		}

		return fallbackLocalId;
	}

	private isWithinRoot(filePath: string, rootPath: string): boolean {
		const relative = path.relative(rootPath, filePath);
		return !relative.startsWith('..') && !path.isAbsolute(relative);
	}

	private tryPath(basePath: string): string | null {
		if (fs.existsSync(`${basePath}.lua`)) {
			return `${basePath}.lua`;
		}

		const initPath = path.join(basePath, 'init.lua');
		if (fs.existsSync(initPath)) {
			return initPath;
		}

		return null;
	}
}
