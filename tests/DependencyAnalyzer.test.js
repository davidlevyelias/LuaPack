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
});
