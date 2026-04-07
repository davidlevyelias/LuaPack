import fs from 'fs';
import path from 'path';

import { resolveExternalEnv } from '../utils/env';
import type { ModuleRecord, WorkflowConfig } from '../analysis/types';
import type { MissingPolicy, NormalizedRule } from '../config/loader/types';

export default class ModuleResolver {
	private readonly sourceRoot: string;
	private readonly moduleRules: Record<string, NormalizedRule>;
	private readonly searchRoots: string[];
	private readonly missingPolicy: MissingPolicy;
	private readonly externalRecursiveDefault: boolean;
	readonly ignoreMissing: boolean;
	private readonly envInfo: { allPaths: string[] };

	constructor(config: WorkflowConfig) {
		const roots =
			Array.isArray(config.modules?.roots) &&
			config.modules.roots.length > 0
				? config.modules.roots
				: [path.dirname(config.entry)];
		this.sourceRoot = roots[0] ?? path.dirname(config.entry);
		this.moduleRules = config.modules?.rules ?? {};
		this.missingPolicy = config.modules?.missing ?? 'error';
		this.ignoreMissing = this.missingPolicy !== 'error';
		this.externalRecursiveDefault =
			typeof config._compat?.externalRecursive === 'boolean'
				? config._compat.externalRecursive
				: true;
		this.envInfo = resolveExternalEnv({
			envConfig: config.modules?.env ?? [],
			sourceRoot: this.sourceRoot,
		}) as { allPaths: string[] };
		this.searchRoots = this.computeSearchRoots(roots);
	}

	normalizeModuleId(moduleId = ''): string {
		return moduleId.replace(/\\/g, '/');
	}

	normalizePath(targetPath = ''): string {
		return targetPath.replace(/\\/g, '/');
	}

	resolve(requirePath: string, currentDir: string): ModuleRecord {
		const moduleId = this.normalizeModuleId(requirePath);
		const rule = this.getRule(moduleId);

		if (rule.mode === 'ignore') {
			return this.createIgnoredRecord(moduleId);
		}

		if (rule.path) {
			const overrideCandidate = this.resolveRulePath(rule.path);
			const resolvedPath = this.tryPath(overrideCandidate);
			if (!resolvedPath) {
				const overrideError = Object.assign(
					new Error(
						`Override path for module '${moduleId}' not found: ${this.normalizePath(rule.path)}`
					),
					{ code: 'MODULE_OVERRIDE_NOT_FOUND' }
				);

				if (this.ignoreMissing) {
					return this.createMissingRecord(moduleId, {
						isExternal: rule.mode === 'external',
						overrideApplied: true,
						error: overrideError,
						filePath:
							this.buildSyntheticOverridePath(overrideCandidate),
					});
				}

				throw overrideError;
			}

			return this.createRecord({
				moduleId,
				filePath: resolvedPath,
				overrideApplied: true,
				rule,
			});
		}

		const pathFromRequire = moduleId.replace(/\./g, path.sep);
		const candidates: string[] = [];

		const pushCandidate = (basePath: string) => {
			if (!candidates.includes(basePath)) {
				candidates.push(basePath);
			}
		};

		pushCandidate(path.resolve(currentDir, pathFromRequire));
		for (const root of this.searchRoots) {
			pushCandidate(path.resolve(root, pathFromRequire));
		}

		for (const candidate of candidates) {
			const resolvedPath = this.tryPath(candidate);
			if (resolvedPath) {
				return this.createRecord({
					moduleId,
					filePath: resolvedPath,
					rule,
				});
			}
		}

		if (this.ignoreMissing) {
			return this.createMissingRecord(moduleId, {
				isExternal: rule.mode === 'external',
			});
		}

		const error = Object.assign(
			new Error(`Module not found: ${moduleId}`),
			{
				code: 'MODULE_NOT_FOUND',
				moduleId,
				requester: currentDir,
			}
		);
		throw error;
	}

	createEntryRecord(filePath: string): ModuleRecord {
		return this.createRecord({
			filePath,
			moduleId: this.deriveModuleName(filePath),
			rule: { mode: 'bundle' },
		});
	}

	createMissingRecordForRequire(
		moduleId: string,
		error?: Error | null
	): ModuleRecord {
		const rule = this.getRule(moduleId);
		return this.createMissingRecord(moduleId, {
			isExternal: rule.mode === 'external',
			error: error ?? null,
			overrideApplied: typeof rule.path === 'string',
		});
	}

	private resolveRulePath(overridePath: string): string {
		const candidate = overridePath.replace(/\.lua$/, '');
		if (path.isAbsolute(candidate)) {
			return candidate;
		}
		return path.resolve(this.sourceRoot, candidate);
	}

	private createIgnoredRecord(moduleId: string): ModuleRecord {
		return {
			id: moduleId,
			moduleName: moduleId,
			filePath: null,
			isIgnored: true,
			isMissing: false,
			isExternal: false,
			overrideApplied: false,
			analyzeDependencies: false,
		};
	}

	createMissingRecord(
		moduleId: string,
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
		return {
			id: moduleId,
			moduleName: moduleId,
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
		moduleId,
		filePath,
		overrideApplied = false,
		rule,
	}: {
		moduleId?: string;
		filePath: string;
		overrideApplied?: boolean;
		rule: NormalizedRule;
	}): ModuleRecord {
		const moduleName = this.deriveModuleName(filePath, moduleId);
		const isExternal = rule.mode === 'external';
		let analyzeDependencies = true;

		if (typeof rule.recursive === 'boolean') {
			analyzeDependencies = rule.recursive !== false;
		} else if (isExternal) {
			analyzeDependencies = this.externalRecursiveDefault;
		}

		return {
			id: moduleId ?? moduleName,
			moduleName,
			filePath,
			isIgnored: false,
			isMissing: false,
			isExternal,
			overrideApplied: overrideApplied || typeof rule.path === 'string',
			analyzeDependencies,
		};
	}

	private computeSearchRoots(roots: string[]): string[] {
		const resolvedPaths = new Set<string>();

		for (const configured of roots) {
			const normalized = path.isAbsolute(configured)
				? configured
				: path.resolve(this.sourceRoot, configured);
			resolvedPaths.add(normalized);
		}

		for (const envPath of this.envInfo.allPaths) {
			resolvedPaths.add(envPath);
		}

		return Array.from(resolvedPaths);
	}

	private getRule(moduleId: string): NormalizedRule {
		const rule = this.moduleRules[moduleId];
		if (!rule) {
			return { mode: 'bundle' };
		}

		return {
			mode: rule.mode,
			path: rule.path,
			recursive: rule.recursive,
		};
	}

	private deriveModuleName(filePath: string, fallbackId?: string): string {
		if (filePath && this.isWithinSource(filePath)) {
			const relativePath = path
				.relative(this.sourceRoot, filePath)
				.replace(/\\/g, '/');
			const withoutExtension = relativePath.replace(/\.lua$/, '');
			if (withoutExtension.endsWith('/init')) {
				const parentPath = withoutExtension.slice(0, -5);
				if (parentPath.length === 0) {
					return fallbackId ?? 'init';
				}
				return parentPath.replace(/\//g, '.');
			}
			return withoutExtension.replace(/\//g, '.');
		}

		if (fallbackId) {
			return fallbackId;
		}

		const normalized = filePath.replace(/\.lua$/, '');
		return normalized.replace(/[\\/]/g, '.');
	}

	private isWithinSource(filePath: string): boolean {
		const relative = path.relative(this.sourceRoot, filePath);
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
