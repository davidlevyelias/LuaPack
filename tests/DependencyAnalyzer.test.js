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
});
