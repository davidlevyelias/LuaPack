const fs = require('fs');
const path = require('path');

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
				throw new Error(
					`Override path for module '${moduleId}' not found: ${override.path}`
				);
			}
			return this.createRecord({
				moduleId,
				filePath: resolvedPath,
				overrideApplied: true,
				overrideConfig: override,
			});
		}

		const pathFromRequire = moduleId.replace(/\./g, path.sep);
		const candidates = [
			path.resolve(currentDir, pathFromRequire),
			path.resolve(this.sourceRoot, pathFromRequire),
		];

		const externalPaths = (this.externalConfig.paths || []).map((p) =>
			path.isAbsolute(p) ? p : path.resolve(this.sourceRoot, p)
		);
		for (const externalRoot of externalPaths) {
			candidates.push(path.resolve(externalRoot, pathFromRequire));
		}

		for (const candidate of candidates) {
			const resolvedPath = this.tryPath(candidate);
			if (resolvedPath) {
				return this.createRecord({
					moduleId,
					filePath: resolvedPath,
					overrideConfig: override || null,
				});
			}
		}

		throw new Error(`Module not found: ${moduleId}`);
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
			isExternal: false,
			overrideApplied: false,
			analyzeDependencies: false,
		};
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
			isExternal,
			overrideApplied,
			analyzeDependencies,
		};
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
