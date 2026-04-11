const fs = require('fs');
const os = require('os');
const path = require('path');

const { DependencyAnalyzer, LuaRequireExtractor } = require('../src/dependency');
const { loadConfig } = require('../src/config/ConfigLoader');

function createTempProject(prefix = 'luapack-demo-') {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	const srcDir = path.join(tempDir, 'src');
	fs.mkdirSync(path.join(srcDir, 'app'), { recursive: true });
	fs.mkdirSync(path.join(srcDir, 'vendor'), { recursive: true });

	fs.writeFileSync(
		path.join(srcDir, 'main.lua'),
		[
			"local greeter = require('app.greeter')",
			"local version = require('vendor.version')",
			'return greeter, version',
		].join('\n')
	);
	fs.writeFileSync(
		path.join(srcDir, 'app', 'greeter.lua'),
		"return { greet = function() return 'hello' end }\n"
	);
	fs.writeFileSync(
		path.join(srcDir, 'vendor', 'version.lua'),
		"return '1.0.0'\n"
	);

	const configPath = path.join(tempDir, 'luapack.config.json');
	fs.writeFileSync(
		configPath,
		JSON.stringify(
			{
				schemaVersion: 2,
				entry: './src/main.lua',
				output: './dist/out.lua',
				missing: 'error',
				packages: {
					default: {
						root: './src',
					},
				},
				bundle: {
					fallback: 'external-only',
				},
			},
			null,
			2
		)
	);

	return {
		tempDir,
		srcDir,
		config: loadConfig({ config: configPath }),
	};
}

function createRequireExtractor() {
	return new LuaRequireExtractor();
}

describe('DependencyAnalyzer', () => {
	test('builds graph with module metadata', () => {
		const fixture = createTempProject();

		try {
			const analyzer = new DependencyAnalyzer(fixture.config);
			const { graph, entryModule } = analyzer.buildDependencyGraph(
				fixture.config.entry
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
		} finally {
			fs.rmSync(fixture.tempDir, { recursive: true, force: true });
		}
	});

	test('marks modules outside source root as external', () => {
		const fixture = createTempProject();

		try {
			const analyzer = new DependencyAnalyzer(fixture.config);
			const { entryModule } = analyzer.buildDependencyGraph(
				fixture.config.entry
			);

			expect(entryModule.isExternal).toBe(false);
		} finally {
			fs.rmSync(fixture.tempDir, { recursive: true, force: true });
		}
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
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
								rules: {
									dkjson: {
										mode: 'bundle',
										path: './src/vendor/dkjson.lua',
										recursive: false,
									},
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
			fs.mkdirSync(path.join(srcDir, 'feature', 'mod'), {
				recursive: true,
			});

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
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
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
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
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
			const node = graph.get(
				path.join(srcDir, 'packages', 'gma2-plugin', 'src', 'init.lua')
			);
			expect(node).toBeDefined();
			expect(node.module.moduleName).toBe('packages.gma2-plugin.src');
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('parses require calls without parentheses and ignores dynamic concatenations', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-bare-require-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(path.join(srcDir, 'core'), { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				[
					"local Class = require 'core.class'",
					"local Utils = require [[core.utils]]",
					"local dynamic = require('core.' .. moduleName)",
					'return Class, Utils, dynamic',
				].join('\n')
			);

			fs.writeFileSync(
				path.join(srcDir, 'core', 'class.lua'),
				'return {}\n'
			);

			fs.writeFileSync(
				path.join(srcDir, 'core', 'utils.lua'),
				'return {}\n'
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
							},
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph, missing } = analyzer.buildDependencyGraph(config.entry);

			const classNode = graph.get(path.join(srcDir, 'core', 'class.lua'));
			const utilsNode = graph.get(path.join(srcDir, 'core', 'utils.lua'));
			expect(classNode).toBeDefined();
			expect(utilsNode).toBeDefined();
			expect(missing).toHaveLength(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('ignores require text inside comments and plain strings', () => {
		const extractor = createRequireExtractor();
		const dependencies = extractor.extract(
			[
				"-- require('comment.only')",
				"local text = \"require('string.only')\"",
				"local other = 'require(\\\"also.string\\\")'",
				'return text, other',
			].join('\n')
		);

		expect(dependencies).toEqual([]);
	});

	test('parses multiline require calls and long-string arguments', () => {
		const extractor = createRequireExtractor();
		const dependencies = extractor.extract(
			[
				'local one = require(',
				'  "core.multi"',
				')',
				'local two = require [[core.long]]',
			].join('\n')
		);

		expect(dependencies).toEqual(['core.multi', 'core.long']);
	});

	test('ignores aliased require calls and dynamic expressions', () => {
		const extractor = createRequireExtractor();
		const dependencies = extractor.extract(
			[
				'local req = require',
				"local one = req('aliased.module')",
				"local two = require('dynamic.' .. name)",
				"local three = require(moduleName)",
			].join('\n')
		);

		expect(dependencies).toEqual([]);
	});

	test('extracts protected require calls passed through pcall', () => {
		const extractor = createRequireExtractor();
		const dependencies = extractor.extract(
			[
				"local ok, slaxml = pcall(require, 'slaxml')",
				"local failed = pcall(require, moduleName)",
			].join('\n')
		);

		expect(dependencies).toEqual(['slaxml']);
	});

	test('honors external recursive flag when disabled', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-external-recursive-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			const externalDir = path.join(tempDir, 'external');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.mkdirSync(externalDir, { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local mod = require('external.module')\nreturn mod\n"
			);

			fs.writeFileSync(
				path.join(externalDir, 'module.lua'),
				"local missing = require('missing.module')\nreturn missing\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								dependencies: {
									external: {
										mode: 'external',
										recursive: false,
									},
								},
							},
							external: {
								root: './external',
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);

			const mainNode = graph.get(path.join(srcDir, 'main.lua'));
			expect(mainNode).toBeDefined();
			expect(mainNode.dependencies).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: '@external/module',
						moduleName: 'external.module',
						isExternal: true,
						isMissing: false,
						filePath: null,
						analyzeDependencies: false,
					}),
				])
			);
			expect(graph.has(path.join(externalDir, 'module.lua'))).toBe(false);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('treats unresolved explicit external modules as runtime-provided', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-explicit-external-runtime-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local slaxml = require('slaxml')\nreturn slaxml\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								rules: {
									slaxml: {
										mode: 'external',
									},
								},
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const result = analyzer.buildDependencyGraph(config.entry);
			const mainNode = result.graph.get(path.join(srcDir, 'main.lua'));

			expect(result.errors).toHaveLength(0);
			expect(result.missing).toHaveLength(0);
			expect(mainNode).toBeDefined();
			expect(mainNode.dependencies).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: '@default/slaxml',
						moduleName: 'slaxml',
						isExternal: true,
						isMissing: false,
						filePath: null,
						ruleApplied: true,
						analyzeDependencies: false,
					}),
				])
			);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('surfaces config warnings through analysis warnings', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-config-warning-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.writeFileSync(path.join(srcDir, 'main.lua'), 'return {}\n');

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
								rules: {
									slaxml: {
										mode: 'external',
										path: './vendor/slaxml.lua',
									},
								},
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const AnalysisPipeline = require('../src/analysis/AnalysisPipeline').default;
			const analysis = new AnalysisPipeline(config).run();

			expect(analysis.warnings).toEqual([
				expect.stringContaining("rule 'default.slaxml' sets mode 'external'"),
			]);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('warns when a bundled package is intentionally unavailable to a caller package', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-mixed-package-policy-warning-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			const packageADir = path.join(tempDir, 'A');
			const packageBDir = path.join(tempDir, 'B');
			const sdkDir = path.join(tempDir, 'sdk');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.mkdirSync(packageADir, { recursive: true });
			fs.mkdirSync(packageBDir, { recursive: true });
			fs.mkdirSync(sdkDir, { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				[
					"local b = require('B.main')",
					"local a = require('A.main')",
					'return a, b',
				].join('\n')
			);
			fs.writeFileSync(
				path.join(packageADir, 'main.lua'),
				"return require('sdk')\n"
			);
			fs.writeFileSync(
				path.join(packageBDir, 'main.lua'),
				"return require('sdk')\n"
			);
			fs.writeFileSync(
				path.join(sdkDir, 'init.lua'),
				'return { value = true }\n'
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						packages: {
							default: {
								root: './src',
								dependencies: {
									A: { mode: 'bundle' },
									B: { mode: 'bundle' },
								},
							},
							A: {
								root: './A',
								dependencies: {
									sdk: { mode: 'external' },
								},
							},
							B: {
								root: './B',
								dependencies: {
									sdk: { mode: 'bundle' },
								},
							},
							sdk: {
								root: './sdk',
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const AnalysisPipeline = require('../src/analysis/AnalysisPipeline').default;
			const analysis = new AnalysisPipeline(config).run();

			expect(analysis.warnings).toEqual(
				expect.arrayContaining([
					expect.stringContaining(
						"Package 'sdk' is included in the bundle, but package 'A' will not use the bundled copy because A marks 'sdk' as external."
					),
				])
			);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('treats additional roots as discovery only unless a rule marks a module external', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-root-discovery-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			const vendorDir = path.join(tempDir, 'vendor', 'shared');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.mkdirSync(vendorDir, { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local helper = require('shared.helper')\nreturn helper\n"
			);
			fs.writeFileSync(path.join(vendorDir, 'helper.lua'), 'return {}\n');

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								dependencies: {
									shared: {
										mode: 'bundle',
										recursive: true,
									},
								},
								rules: {},
							},
							shared: {
								root: './vendor/shared',
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph } = analyzer.buildDependencyGraph(config.entry);
			const node = graph.get(path.join(vendorDir, 'helper.lua'));

			expect(node).toBeDefined();
			expect(node.module.isExternal).toBe(false);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('skips ignored modules declared by rule mode', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-ignore-rule-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });

			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local skipped = require('legacy.temp')\nreturn skipped\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								rules: {
									'legacy.temp': {
										mode: 'ignore',
									},
								},
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const { graph, missing, errors } = analyzer.buildDependencyGraph(config.entry);

			expect(graph.size).toBe(1);
			expect(missing).toHaveLength(0);
			expect(errors).toHaveLength(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('treats missing policy warn as non-fatal', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-missing-warn-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local missing = require('missing.module')\nreturn missing\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'warn',
						packages: {
							default: {
								root: './src',
								rules: {},
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const result = analyzer.buildDependencyGraph(config.entry);

			expect(result.errors).toHaveLength(0);
			expect(result.missing).toHaveLength(1);
			expect(result.missing[0].fatal).toBe(false);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('treats missing policy error as fatal', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-missing-error-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				"local missing = require('missing.module')\nreturn missing\n"
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								rules: {},
							},
						},
						bundle: {
							fallback: 'external-only',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const result = analyzer.buildDependencyGraph(config.entry);

			expect(result.errors).toHaveLength(1);
			expect(result.missing).toHaveLength(1);
			expect(result.missing[0].fatal).toBe(true);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('ignores invalid paths on external rules and records a config warning instead of a missing module', () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-invalid-rule-path-')
		);

		try {
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			fs.writeFileSync(
				path.join(srcDir, 'main.lua'),
				[
					"local json = require('dkjson')",
					"local text = require('util.text')",
					'return json, text',
				].join('\n')
			);
			fs.mkdirSync(path.join(srcDir, 'util'), { recursive: true });
			fs.writeFileSync(
				path.join(srcDir, 'util', 'text.lua'),
				'return { value = true }\n'
			);

			const configPath = path.join(tempDir, 'luapack.config.json');
			fs.writeFileSync(
				configPath,
				JSON.stringify(
					{
						schemaVersion: 2,
						entry: './src/main.lua',
						output: './dist/out.lua',
						missing: 'error',
						packages: {
							default: {
								root: './src',
								rules: {
									dkjson: {
										mode: 'external',
										path: './external/dkjson-missing',
										recursive: false,
									},
								},
							},
						},
						bundle: {
							fallback: 'never',
						},
					},
					null,
					2
				)
			);

			const config = loadConfig({ config: configPath });
			const analyzer = new DependencyAnalyzer(config);
			const result = analyzer.buildDependencyGraph(config.entry);

			expect(result.errors).toHaveLength(0);
			expect(result.missing).toHaveLength(0);
			expect(result.graph.size).toBe(2);
			expect(result.graph.get(path.join(srcDir, 'main.lua')).dependencies).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						moduleName: 'dkjson',
						isMissing: false,
						isExternal: true,
						ruleApplied: true,
					}),
					expect.objectContaining({ moduleName: 'util.text' }),
				])
			);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
