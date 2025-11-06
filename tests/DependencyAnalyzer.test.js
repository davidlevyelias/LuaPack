const fs = require('fs');
const os = require('os');
const path = require('path');

const DependencyAnalyzer = require('../src/DependencyAnalyzer');
const { loadConfig } = require('../src/config/ConfigLoader');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function loadExampleConfig() {
	return loadConfig({
		config: path.join(PROJECT_ROOT, 'examples/luapack.config.json'),
	});
}

describe('DependencyAnalyzer', () => {
	test('builds graph with module metadata', () => {
		const config = loadExampleConfig();
		const analyzer = new DependencyAnalyzer(config);
		const { graph, entryModule } = analyzer.buildDependencyGraph(
			config.entry
		);
		const sortedModules = analyzer.topologicalSort(graph);

		const moduleNames = sortedModules.map((record) => record.moduleName);

		expect(entryModule.moduleName).toBe('main');
		expect(moduleNames).toEqual(
			expect.arrayContaining(['app.greeter', 'vendor.version'])
		);
		expect(moduleNames[moduleNames.length - 1]).toBe(
			entryModule.moduleName
		);
	});

	test('marks modules outside source root as external', () => {
		const config = loadExampleConfig();
		const analyzer = new DependencyAnalyzer(config);
		const { entryModule } = analyzer.buildDependencyGraph(config.entry);

		expect(entryModule.isExternal).toBe(false);
	});

	test('skips dependency analysis when override disables recursion', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-analyzer-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(path.join(srcDir, 'vendor'), { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local json = require('dkjson')\nreturn json\n"
			);

			fs.writeFileSync(
				path.join(srcDir, 'vendor', 'dkjson.lua'),
				"local lpeg = require('lpeg')\nreturn {}\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						entry: './src/main.lua',
						output: './dist/out.lua',
						sourceRoot: './src',
						modules: {
							overrides: {
								dkjson: {
									path: './vendor/dkjson.lua',
									recursive: false,
								},
							},
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);

			const node = graph.get(path.join(srcDir, 'vendor', 'dkjson.lua'));
			expect(node).toBeDefined();
			expect(node.dependencies).toHaveLength(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('uses parent module name for directories resolved via init.lua', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-init-module-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(path.join(srcDir, 'feature', 'mod'), { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local mod = require('feature.mod')\nreturn mod\n"
			);

			fs.writeFileSync(
				path.join(srcDir, 'feature', 'mod', 'init.lua'),
				'return { value = 1 }\n'
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						entry: './src/main.lua',
						output: './dist/out.lua',
						sourceRoot: './src',
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);
			const node = graph.get(
				path.join(srcDir, 'feature', 'mod', 'init.lua')
			);
			expect(node).toBeDefined();
			expect(node.module.moduleName).toBe('feature.mod');
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('parses require identifiers that contain hyphenated segments', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-hyphen-module-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(path.join(srcDir, 'packages', 'gma2-plugin', 'src'), {
				recursive: true,
			});

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local Main = require('packages.gma2-plugin.src.init')\nreturn Main\n"
			);

			fs.writeFileSync(
				path.join(srcDir, 'packages', 'gma2-plugin', 'src', 'init.lua'),
				'return { value = 2 }\n'
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						entry: './src/main.lua',
						output: './dist/out.lua',
						sourceRoot: './src',
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);
			const node = graph.get(
				path.join(srcDir, 'packages', 'gma2-plugin', 'src', 'init.lua')
			);
			expect(node).toBeDefined();
			expect(node.module.moduleName).toBe('packages.gma2-plugin.src');
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('honors external recursive flag when disabled', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-external-recursive-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			const externalDir = path.join(tempDir, 'external');
			const externalModuleDir = path.join(externalDir, 'external');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.mkdirSync(externalModuleDir, { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local mod = require('external.module')\nreturn mod\n"
			);

			fs.writeFileSync(
				path.join(externalModuleDir, 'module.lua'),
				"local missing = require('missing.module')\nreturn missing\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						entry: './src/main.lua',
						output: './dist/out.lua',
						sourceRoot: './src',
						modules: {
							external: {
								recursive: false,
								paths: [externalDir],
							},
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);

			const externalModulePath = path.join(
				externalModuleDir,
				'module.lua'
			);
			const node = graph.get(externalModulePath);
			expect(node).toBeDefined();
			expect(node.module.analyzeDependencies).toBe(false);
			expect(node.dependencies).toHaveLength(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
