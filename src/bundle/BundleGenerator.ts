import type { BundlePlan, BundledModule } from './types';

type PackageResolverStrategy = 'none' | 'single' | 'multi';
type RuntimeFallbackStrategy = 'none' | 'external-only' | 'always';

interface RuntimeShape {
	entryPackageName: string;
	packagePrefixes: string[];
	externalModules: string[];
	packageDependencyModes: Record<string, Record<string, 'external' | 'ignore'>>;
	packageResolver: PackageResolverStrategy;
	fallback: RuntimeFallbackStrategy;
	needsOriginalRequire: boolean;
}

function quoteLuaString(value: string): string {
	return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function indentBlock(content: string, depth = 1): string {
	const prefix = '\t'.repeat(depth);
	return content
		.split('\n')
		.map((line) => (line.length ? `${prefix}${line}` : ''))
		.join('\n');
}

function normalizePackagePrefixes(bundlePlan: BundlePlan): string[] {
	const packagePrefixSet = new Set(
		Array.isArray(bundlePlan.packagePrefixes)
			? bundlePlan.packagePrefixes.filter(
					(packageName) => packageName && packageName !== 'default'
				)
			: []
	);

	if (
		bundlePlan.entryPackageName &&
		bundlePlan.entryPackageName !== 'default'
	) {
		packagePrefixSet.add(bundlePlan.entryPackageName);
	}

	for (const bundledModule of bundlePlan.bundledModules || []) {
		if (bundledModule.packageName && bundledModule.packageName !== 'default') {
			packagePrefixSet.add(bundledModule.packageName);
		}
	}

	return Array.from(packagePrefixSet).sort((a, b) => b.length - a.length);
}

function normalizeExternalModules(bundlePlan: BundlePlan): string[] {
	return Array.from(new Set(bundlePlan.externalModules || [])).sort();
}

function deriveRuntimeShape(bundlePlan: BundlePlan): RuntimeShape {
	const packagePrefixes = normalizePackagePrefixes(bundlePlan);
	const externalModules = normalizeExternalModules(bundlePlan);
	const packageDependencyModes = bundlePlan.packageDependencyModes || {};
	let fallback: RuntimeFallbackStrategy = 'none';

	if (bundlePlan.fallbackPolicy === 'always') {
		fallback = 'always';
	} else if (
		bundlePlan.fallbackPolicy === 'external-only' &&
		externalModules.length > 0
	) {
		fallback = 'external-only';
	}

	let packageResolver: PackageResolverStrategy = 'none';
	if (packagePrefixes.length === 1) {
		packageResolver = 'single';
	} else if (packagePrefixes.length > 1) {
		packageResolver = 'multi';
	}

	return {
		entryPackageName: bundlePlan.entryPackageName || 'default',
		packagePrefixes,
		externalModules,
		packageDependencyModes,
		packageResolver,
		fallback,
		needsOriginalRequire:
			externalModules.length > 0 ||
			Object.values(packageDependencyModes).some((scopedModes) =>
				Object.values(scopedModes || {}).includes('external')
			) ||
			fallback !== 'none',
	};
}

function renderLoadExternalModule(shape: RuntimeShape): string {
	if (!shape.needsOriginalRequire) {
		return '';
	}

	return [
		'local function load_external_module(module_name)',
		'\tif require_loaded[module_name] then return require_cache[module_name] end',
		'\tif not original_require then',
		`\t\terror("Module '" .. module_name .. "' requires the host require function.")`,
		'\tend',
		'\tlocal result = original_require(module_name)',
		'\trequire_cache[module_name] = result',
		'\trequire_loaded[module_name] = true',
		'\treturn result',
		'end',
	].join('\n');
}

function renderFallbackOnMiss(shape: RuntimeShape): string {
	if (shape.fallback === 'always') {
		return [
			'if original_require then',
			'\tlocal result = original_require(module_name)',
			'\trequire_cache[module_name] = result',
			'\trequire_loaded[module_name] = true',
			'\treturn result',
			'end',
			`error("Module '" .. module_name .. "' not found.")`,
		].join('\n');
	}

	if (shape.fallback === 'external-only') {
		return [
			'if external_modules[module_name] == true and original_require then',
			'\tlocal result = original_require(module_name)',
			'\trequire_cache[module_name] = result',
			'\trequire_loaded[module_name] = true',
			'\treturn result',
			'end',
			`error("Module '" .. module_name .. "' not found.")`,
		].join('\n');
	}

	return `error("Module '" .. module_name .. "' not found.")`;
}

function renderResolveScopedName(shape: RuntimeShape): string {
	if (shape.packageResolver === 'none') {
		return '';
	}

	const declaredPackageChecks =
		shape.packageResolver === 'single'
			? (() => {
					const packageName = shape.packagePrefixes[0];
					const candidate = `${packageName}.`;
					return [
						`if module_name == ${quoteLuaString(packageName)} or module_name:sub(1, ${candidate.length}) == ${quoteLuaString(candidate)} then`,
						'\treturn module_name',
						'end',
					].join('\n');
			  })()
			: shape.packagePrefixes
					.map((packageName) => {
						const candidate = `${packageName}.`;
						return [
							`if module_name == ${quoteLuaString(packageName)} or module_name:sub(1, ${candidate.length}) == ${quoteLuaString(candidate)} then`,
							'\treturn module_name',
							'end',
						].join('\n');
					})
					.join('\n');

	return [
		'local function resolve_declared_package(module_name)',
		indentBlock(declaredPackageChecks),
		'\treturn nil',
		'end',
		'local function resolve_scoped_name(package_name, module_name)',
		'\tlocal declared_package = resolve_declared_package(module_name)',
		'\tif declared_package then',
		'\t\treturn module_name, declared_package',
		'\tend',
		'\tif package_name and package_name ~= "default" then',
		'\t\treturn package_name .. "." .. module_name, package_name',
		'\tend',
		'\treturn module_name, "default"',
		'end',
	].join('\n');
}

function renderResolveModuleName(): string {
	return [
		'local function resolve_module_name(module_name)',
		'\tif modules[module_name] then return module_name end',
		'\tif module_name:sub(-5) == ".init" then',
		'\t\tlocal parent = module_name:sub(1, -6)',
		'\t\tif parent ~= "" and modules[parent] then return parent end',
		'\t\treturn nil',
		'\tend',
		'\tlocal with_init = module_name .. ".init"',
		'\tif modules[with_init] then return with_init end',
		'\treturn nil',
		'end',
	].join('\n');
}

function renderPackageDependencyModeTable(shape: RuntimeShape): string {
	const packageEntries = Object.entries(shape.packageDependencyModes || {});
	if (packageEntries.length === 0) {
		return '';
	}

	const renderedEntries = packageEntries
		.map(([packageName, scopedModes]) => {
			const modeEntries = Object.entries(scopedModes || {})
				.map(
					([dependencyName, mode]) =>
						`\t\t[${quoteLuaString(dependencyName)}] = ${quoteLuaString(mode)},`
				)
				.join('\n');

			return [
				`\t[${quoteLuaString(packageName)}] = {`,
				modeEntries,
				'\t},',
			].join('\n');
		})
		.join('\n');

	return ['local package_dependency_modes = {', renderedEntries, '}'].join('\n');
}

function renderResolveDependencyMode(shape: RuntimeShape): string {
	if (Object.keys(shape.packageDependencyModes || {}).length === 0) {
		return '';
	}

	return [
		'local function resolve_dependency_mode(requester_package_name, target_package_name)',
		'\tif not requester_package_name or not target_package_name then return nil end',
		'\tlocal package_modes = package_dependency_modes[requester_package_name]',
		'\tif not package_modes then return nil end',
		'\treturn package_modes[target_package_name]',
		'end',
	].join('\n');
}

function renderRequireAbsolute(shape: RuntimeShape): string {
	const ignoreGuard =
		Object.keys(shape.packageDependencyModes || {}).length === 0
			? ''
			: [
				'\tlocal dependency_mode = resolve_dependency_mode(requester_package_name, target_package_name)',
				'\tif dependency_mode == "ignore" then',
				`\t\terror("Module '" .. module_name .. "' is ignored for package '" .. requester_package_name .. "'.")`,
				'\tend',
				'\tif dependency_mode == "external" then',
				'\t\treturn load_external_module(module_name)',
				'\tend',
			].join('\n');
	const explicitExternalGuard =
		shape.externalModules.length === 0
			? ''
			: [
				'\tif external_modules[module_name] == true then',
				'\t\treturn load_external_module(module_name)',
				'\tend',
			].join('\n');

	return [
		'local function __lp_require_absolute(requester_package_name, target_package_name, module_name, ...)',
		'\tif require_loaded[module_name] then return require_cache[module_name] end',
		ignoreGuard,
		explicitExternalGuard,
		'',
		'\tlocal resolved_name = resolve_module_name(module_name)',
		'\tif not resolved_name then',
		indentBlock(renderFallbackOnMiss(shape), 2),
		'\tend',
		'',
		'\tif require_loaded[resolved_name] then',
		'\t\tlocal cached = require_cache[resolved_name]',
		'\t\trequire_cache[module_name] = cached',
		'\t\trequire_loaded[module_name] = true',
		'\t\treturn cached',
		'\tend',
		'',
		'\tlocal module_func = modules[resolved_name]',
		'\tlocal result = module_func(...)',
		'\trequire_cache[resolved_name] = result',
		'\trequire_loaded[resolved_name] = true',
		'\trequire_cache[module_name] = result',
		'\trequire_loaded[module_name] = true',
		'\treturn result',
		'end',
	].join('\n');
}

function renderScopedRequireHelpers(shape: RuntimeShape): string {
	if (shape.packageResolver === 'none') {
		return [
			'local function __lp_require(module_name, ...)',
			'\treturn __lp_require_absolute("default", "default", module_name, ...)',
			'end',
		].join('\n');
	}

	return [
		renderResolveScopedName(shape),
		'local function __lp_require_scoped(package_name)',
		'\treturn function(module_name, ...)',
		'\t\tlocal scoped_name, target_package_name = resolve_scoped_name(package_name, module_name)',
		'\t\treturn __lp_require_absolute(package_name or "default", target_package_name, scoped_name, ...)',
		'\tend',
		'end',
		'local function __lp_require(module_name, ...)',
		`\tlocal scoped_name, target_package_name = resolve_scoped_name(${quoteLuaString(shape.entryPackageName)}, module_name)`,
		`\treturn __lp_require_absolute(${quoteLuaString(shape.entryPackageName)}, target_package_name, scoped_name, ...)`,
		'end',
	].join('\n');
}

function renderModuleDefinition(moduleRecord: BundledModule): string {
	const normalizedContent = moduleRecord.content
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');

	return [
		`modules[${quoteLuaString(moduleRecord.moduleName)}] = function(...)`,
		indentBlock(normalizedContent),
		'end',
	].join('\n');
}

function renderModuleBlocks(bundlePlan: BundlePlan, shape: RuntimeShape): string {
	const bundledModules = Array.isArray(bundlePlan.bundledModules)
		? bundlePlan.bundledModules
		: [];
	if (bundledModules.length === 0) {
		return '';
	}

	const groupedModules = new Map<string, BundledModule[]>();
	for (const bundledModule of bundledModules) {
		const packageName = bundledModule.packageName || 'default';
		const existing = groupedModules.get(packageName) || [];
		existing.push(bundledModule);
		groupedModules.set(packageName, existing);
	}

	if (shape.packageResolver === 'none') {
		const moduleDefinitions = bundledModules
			.map((bundledModule) => renderModuleDefinition(bundledModule))
			.join('\n');
		return [
			'do',
			'\tlocal require = __lp_require',
			indentBlock(moduleDefinitions),
			'end',
		].join('\n');
	}

	return Array.from(groupedModules.entries())
		.map(([packageName, modules]) => {
			const moduleDefinitions = modules
				.map((bundledModule) => renderModuleDefinition(bundledModule))
				.join('\n');
			return [
				'do',
				`\tlocal require = __lp_require_scoped(${quoteLuaString(packageName)})`,
				indentBlock(moduleDefinitions),
				'end',
			].join('\n');
		})
		.join('\n');
}

function renderExternalModuleTable(shape: RuntimeShape): string {
	if (shape.externalModules.length === 0) {
		return '';
	}

	const entries = shape.externalModules
		.map((moduleName) => `\t[${quoteLuaString(moduleName)}] = true,`)
		.join('\n');

	return ['local external_modules = {', entries, '}'].join('\n');
}

export default class BundleGenerator {
	createBundleTemplate(bundlePlan: BundlePlan): string {
		const shape = deriveRuntimeShape(bundlePlan);
		const runtimeSections = [
			'local modules = {}',
			'local require_cache = {}',
			'local require_loaded = {}',
			shape.needsOriginalRequire ? 'local original_require = require' : '',
			renderExternalModuleTable(shape),
			renderPackageDependencyModeTable(shape),
			renderResolveModuleName(),
			renderResolveDependencyMode(shape),
			renderLoadExternalModule(shape),
			renderRequireAbsolute(shape),
			renderScopedRequireHelpers(shape),
			renderModuleBlocks(bundlePlan, shape),
			`return __lp_require(${quoteLuaString(bundlePlan.entryModuleName)}, ...)`,
		];

		return runtimeSections.filter(Boolean).join('\n') + '\n';
	}

	async generateBundle(bundlePlan: BundlePlan): Promise<string> {
		return this.createBundleTemplate(bundlePlan);
	}
}
