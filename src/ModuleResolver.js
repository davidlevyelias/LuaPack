const fs = require('fs');
const path = require('path');
const { resolveExternalEnv } = require('./utils/env');

class ModuleResolver {
	constructor(config) {
		this.sourceRoot = config.sourceRoot;
		this.modulesConfig = config.modules || {};
		this.ignoreSet = new Set(
			(this.modulesConfig.ignore || []).map((id) =>
				this.normalizeModuleId(id)
			)
		);
		this.overrides = this.modulesConfig.overrides || {};
		this.externalConfig = this.modulesConfig.external || {};
		this.ignoreMissing = Boolean(this.modulesConfig.ignoreMissing);
		this.envInfo = resolveExternalEnv({
			envConfig: this.externalConfig.env,
			sourceRoot: this.sourceRoot,
		});
		this.externalRoots = this.computeExternalRoots();
	}

	normalizeModuleId(moduleId = '') {
		return moduleId.replace(/\\/g, '/');
	}

	resolve(requirePath, currentDir) {
		const moduleId = this.normalizeModuleId(requirePath);

		if (this.ignoreSet.has(moduleId)) {
			return this.createIgnoredRecord(moduleId);
		}

		const override = this.overrides[moduleId];
		if (override && override.path) {
			const overrideCandidate = this.resolveOverridePath(override.path);
			const resolvedPath = this.tryPath(overrideCandidate);
			if (!resolvedPath) {
				const overrideError = new Error(
					`Override path for module '${moduleId}' not found: ${override.path}`
				);
				overrideError.code = 'MODULE_OVERRIDE_NOT_FOUND';
				if (this.ignoreMissing) {
					return this.createMissingRecord(moduleId, {
						isExternal: !this.isWithinSource(overrideCandidate),
						overrideApplied: true,
						error: overrideError,
						filePath: this.buildSyntheticOverridePath(overrideCandidate),
					});
				}
				throw overrideError;
			}
			return this.createRecord({
				moduleId,
				filePath: resolvedPath,
				overrideApplied: true,
				overrideConfig: override,
			});
		}

		const pathFromRequire = moduleId.replace(/\./g, path.sep);
		const candidates = [];

		const pushCandidate = (basePath, isExternal) => {
			candidates.push({
				basePath,
				isExternal,
			});
		};

		const resolvedLocal = path.resolve(currentDir, pathFromRequire);
		pushCandidate(resolvedLocal, !this.isWithinSource(resolvedLocal));

		const resolvedSource = path.resolve(this.sourceRoot, pathFromRequire);
		pushCandidate(resolvedSource, false);

		for (const externalRoot of this.externalRoots) {
			const resolvedExternal = path.resolve(externalRoot, pathFromRequire);
			pushCandidate(resolvedExternal, true);
		}

		for (const candidate of candidates) {
			const resolvedPath = this.tryPath(candidate.basePath);
			if (resolvedPath) {
				return this.createRecord({
					moduleId,
					filePath: resolvedPath,
					overrideConfig: override || null,
				});
			}
		}

		if (this.ignoreMissing) {
			const hasInternalCandidate = candidates.some((candidate) => !candidate.isExternal);
			const isExternalMiss = !hasInternalCandidate;
			return this.createMissingRecord(moduleId, { isExternal: isExternalMiss });
		}

		const error = new Error(`Module not found: ${moduleId}`);
		error.code = 'MODULE_NOT_FOUND';
		error.moduleId = moduleId;
		error.requester = currentDir;
		throw error;
	}

	createEntryRecord(filePath) {
		return this.createRecord({
			filePath,
			moduleId: this.deriveModuleName(filePath),
		});
	}

	resolveOverridePath(overridePath) {
		const candidate = overridePath.replace(/\.lua$/, '');
		if (path.isAbsolute(candidate)) {
			return candidate;
		}
		return path.resolve(this.sourceRoot, candidate);
	}

	createIgnoredRecord(moduleId) {
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
		moduleId,
		{ isExternal = false, overrideApplied = false, error = null, filePath = null } = {}
	) {
		return {
			id: moduleId,
			moduleName: moduleId,
			filePath,
			isIgnored: false,
			isMissing: true,
			isExternal,
			overrideApplied: Boolean(overrideApplied),
			analyzeDependencies: false,
			missingError: error || null,
		};
	}

	buildSyntheticOverridePath(basePath) {
		if (!basePath) {
			return null;
		}
		const normalized = basePath.replace(/[\\/]+$/, '');
		if (normalized.endsWith('.lua')) {
			return normalized;
		}
		return `${normalized}.lua`;
	}

	createRecord({
		moduleId,
		filePath,
		overrideApplied = false,
		overrideConfig = null,
	}) {
		const moduleName = this.deriveModuleName(filePath, moduleId);
		const isExternal = !this.isWithinSource(filePath);
		let analyzeDependencies = true;
		if (overrideConfig && typeof overrideConfig.recursive === 'boolean') {
			analyzeDependencies = overrideConfig.recursive !== false;
		} else if (isExternal) {
			const externalRecursive = this.externalConfig.recursive;
			if (typeof externalRecursive === 'boolean') {
				analyzeDependencies = externalRecursive !== false;
			}
		}

		return {
			id: moduleId || moduleName,
			moduleName,
			filePath,
			isIgnored: false,
			isMissing: false,
			isExternal,
			overrideApplied,
			analyzeDependencies,
		};
	}

	computeExternalRoots() {
		const resolvedPaths = new Set();
		const configuredPaths = Array.isArray(this.externalConfig.paths)
			? this.externalConfig.paths
			: [];

		for (const configured of configuredPaths) {
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

	deriveModuleName(filePath, fallbackId) {
		if (filePath && this.isWithinSource(filePath)) {
			const relativePath = path
				.relative(this.sourceRoot, filePath)
				.replace(/\\/g, '/');
			const withoutExtension = relativePath.replace(/\.lua$/, '');
			if (withoutExtension.endsWith('/init')) {
				const parentPath = withoutExtension.slice(0, -5);
				if (parentPath.length === 0) {
					return fallbackId || 'init';
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

	isWithinSource(filePath) {
		const relative = path.relative(this.sourceRoot, filePath);
		return !relative.startsWith('..') && !path.isAbsolute(relative);
	}

	tryPath(basePath) {
		if (fs.existsSync(`${basePath}.lua`)) {
			return `${basePath}.lua`;
		}

		if (fs.existsSync(path.join(basePath, 'init.lua'))) {
			return path.join(basePath, 'init.lua');
		}

		return null;
	}
}

module.exports = ModuleResolver;
