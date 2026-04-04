const fs = require('fs');
const os = require('os');
const path = require('path');

const { BundleGenerator, BundlePlanBuilder, LuaPacker } = require('../src/bundle');

function createTempLuaFile(content = 'return {}') {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
	const filePath = path.join(dir, 'main.lua');
	fs.writeFileSync(filePath, content);
	return { dir, filePath };
}

describe('BundleGenerator', () => {
	test('LuaPacker writes the generated bundle to disk', async () => {
		const { dir, filePath } = createTempLuaFile('return { value = 42 }');
		const outputPath = path.join(dir, 'bundle.lua');
		const config = {
			entry: filePath,
			output: outputPath,
			sourceRoot: dir,
		};
		const packer = new LuaPacker(config);
		const moduleRecord = {
			moduleName: 'main',
			filePath,
			isIgnored: false,
			isExternal: false,
		};
		const analysisResult = {
			entryModule: moduleRecord,
			sortedModules: [moduleRecord],
			metrics: {},
		};

		try {
			await packer.pack(analysisResult);
			const bundle = fs.readFileSync(outputPath, 'utf-8');
			expect(bundle).toContain('modules["main"] = function(...)');
			expect(bundle).toContain('return __lp_require("main", ...)');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('LuaPacker records bundle size after writing output', async () => {
		const { dir, filePath } = createTempLuaFile('return { value = 42 }');
		const outputPath = path.join(dir, 'bundle.lua');
		const config = {
			entry: filePath,
			output: outputPath,
			sourceRoot: dir,
		};
		const packer = new LuaPacker(config);
		const moduleRecord = {
			moduleName: 'main',
			filePath,
			isIgnored: false,
			isExternal: false,
		};
		const analysisResult = {
			entryModule: moduleRecord,
			sortedModules: [moduleRecord],
			metrics: {},
		};

		try {
			await packer.pack(analysisResult);
			const bundleStats = fs.statSync(outputPath);
			expect(analysisResult.metrics.bundleSizeBytes).toBe(bundleStats.size);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('emits require shim that handles init aliases', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
		try {
			const initDir = path.join(dir, 'packages', 'app', 'src');
			fs.mkdirSync(initDir, { recursive: true });
			const initFile = path.join(initDir, 'init.lua');
			fs.writeFileSync(initFile, 'return { answer = 42 }\n');

			const config = {
				sourceRoot: dir,
			};

			const generator = new BundleGenerator(config);
			const planBuilder = new BundlePlanBuilder(config);
			const moduleRecord = {
				moduleName: 'packages.app.src',
				filePath: initFile,
				isIgnored: false,
				isExternal: false,
				isMissing: false,
			};
			const bundlePlan = planBuilder.build(moduleRecord, [moduleRecord]);
			const bundle = await generator.generateBundle(bundlePlan);

			expect(bundle).toContain('module_name:sub(-5) == ".init"');
			expect(bundle).toContain(
				'local with_init = module_name .. ".init"'
			);
			expect(bundle).toContain('local original_require = require');
			expect(bundle).toContain('local function __lp_require(module_name, ...)');
			expect(bundle).toContain(
				'local result = original_require(module_name)'
			);
			expect(bundle).toContain(
				'local resolved_name = resolve_module_name(module_name)'
			);
			expect(bundle).toContain(
				'return __lp_require("packages.app.src", ...)'
			);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('does not inline modules marked as external in the bundle plan', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
		try {
			const srcDir = path.join(dir, 'src');
			const vendorDir = path.join(dir, 'vendor');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.mkdirSync(vendorDir, { recursive: true });

			const mainFile = path.join(srcDir, 'main.lua');
			const externalFile = path.join(vendorDir, 'sdk.lua');
			fs.writeFileSync(mainFile, "local sdk = require('sdk')\nreturn sdk\n");
			fs.writeFileSync(externalFile, 'return { provided = true }\n');

			const config = {
				sourceRoot: srcDir,
				_v2: {
					bundle: {
						mode: 'runtime',
						fallback: 'external-only',
					},
				},
			};

			const planBuilder = new BundlePlanBuilder(config);
			const generator = new BundleGenerator(config);
			const entryModule = {
				moduleName: 'main',
				filePath: mainFile,
				isIgnored: false,
				isExternal: false,
				isMissing: false,
			};
			const externalModule = {
				moduleName: 'sdk',
				filePath: externalFile,
				isIgnored: false,
				isExternal: true,
				isMissing: false,
			};

			const bundlePlan = planBuilder.build(entryModule, [
				entryModule,
				externalModule,
			]);
			const bundle = await generator.generateBundle(bundlePlan);

			expect(bundle).toContain('modules["main"] = function(...)');
			expect(bundle).not.toContain('modules["sdk"] = function(...)');
			expect(bundle).toContain('["sdk"] = true');
			expect(bundlePlan.externalModules).toEqual(['sdk']);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('disables runtime fallback when bundle fallback policy is never', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [],
			externalModules: ['sdk'],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'never',
			mode: 'runtime',
		});

		expect(bundle).toContain('local function can_fallback(module_name)');
		expect(bundle).toContain('return false');
		expect(bundle).not.toContain('return external_modules[module_name] == true');
	});

	test('limits runtime fallback to declared external modules for external-only policy', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [],
			externalModules: ['sdk'],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'external-only',
			mode: 'runtime',
		});

		expect(bundle).toContain('return external_modules[module_name] == true');
	});

	test('allows unrestricted runtime fallback for always policy', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [],
			externalModules: [],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'always',
			mode: 'runtime',
		});

		expect(bundle).toContain('return true');
	});

	test('uses the typed template when bundle mode is typed', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [],
			externalModules: [],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'external-only',
			mode: 'typed',
		});

		expect(bundle).toContain('---@alias __lp_ModuleLoader fun(...): any');
		expect(bundle).toContain('---@type table<string, __lp_ModuleLoader>');
		expect(bundle).toContain('return __lp_require("main", ...)');
	});

	test('hoists LuaCATS declarations in typed mode', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [
				{
					moduleName: 'main',
					filePath: 'main.lua',
					content: [
						'---@class DemoWidget',
						'---@field label string',
						'local DemoWidget = {}',
						'return DemoWidget',
					].join('\n'),
				},
			],
			externalModules: [],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'external-only',
			mode: 'typed',
		});

		expect(bundle).toContain('---@class DemoWidget\n---@field label string');
		expect(bundle).toContain('modules["main"] = function(...)\n\tlocal DemoWidget = {}');
		expect(bundle).not.toContain('modules["main"] = function(...)\n\t---@class DemoWidget');
	});

	test('dedupes identical LuaCATS declarations in typed mode', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);
		const bundle = await generator.generateBundle({
			entryModuleName: 'main',
			bundledModules: [
				{
					moduleName: 'main',
					filePath: 'main.lua',
					content: '---@alias SharedMode "a"|"b"\nreturn {}',
				},
				{
					moduleName: 'secondary',
					filePath: 'secondary.lua',
					content: '---@alias SharedMode "a"|"b"\nreturn {}',
				},
			],
			externalModules: [],
			ignoredModules: [],
			aliases: [],
			fallbackPolicy: 'external-only',
			mode: 'typed',
		});

		expect(bundle.match(/---@alias SharedMode/g)).toHaveLength(1);
	});

	test('fails on conflicting LuaCATS declarations in typed mode', async () => {
		const config = { sourceRoot: process.cwd() };
		const generator = new BundleGenerator(config);

		await expect(
			generator.generateBundle({
				entryModuleName: 'main',
				bundledModules: [
					{
						moduleName: 'main',
						filePath: 'main.lua',
						content: '---@alias SharedMode "a"|"b"\nreturn {}',
					},
					{
						moduleName: 'secondary',
						filePath: 'secondary.lua',
						content: '---@alias SharedMode "c"|"d"\nreturn {}',
					},
				],
				externalModules: [],
				ignoredModules: [],
				aliases: [],
				fallbackPolicy: 'external-only',
				mode: 'typed',
			})
		).rejects.toThrow(/Typed declaration conflict for 'SharedMode'/);
	});
});
