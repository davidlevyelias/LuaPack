const fs = require('fs');
const os = require('os');
const path = require('path');

const AnalysisReporter = require('../src/analysis/AnalysisReporter').default;
const logger = require('../src/utils/Logger');

function normalizeJsonPath(targetPath) {
	return targetPath.replace(/\\/g, '/');
}

function createAnalysisResult() {
	return {
		success: true,
		durationMs: 1,
		entryModule: {
			id: 'main',
			moduleName: 'main',
			packageName: 'default',
			localModuleId: 'main',
			canonicalModuleId: '@default/main',
			filePath: path.resolve('src/main.lua'),
			isExternal: false,
			ruleApplied: false,
			overrideApplied: false,
			analyzeDependencies: true,
			isMissing: false,
		},
		modules: [],
		externals: [],
		moduleById: new Map(),
		dependencyGraph: new Map(),
		sortedModules: [],
		missing: [],
		warnings: [],
		errors: [],
		metrics: {
			moduleCount: 0,
			externalCount: 0,
			missingCount: 0,
			moduleSizeSum: 0,
			estimatedBundleSize: 0,
			bundleSizeBytes: 0,
		},
		context: {
			rootDir: path.resolve('src'),
			roots: [path.resolve('src')],
			packages: [
				{
					name: 'default',
					root: path.resolve('src'),
					isEntry: true,
				},
			],
			entryPath: path.resolve('src/main.lua'),
			outputPath: path.resolve('dist/out.lua'),
			analyzeOnly: true,
			ignoredPatterns: [],
			missingPolicy: 'error',
			fallbackPolicy: 'external-only',
			ignoreMissing: false,
			externals: {
				enabled: false,
				recursive: true,
				paths: [],
			},
		},
	};
}

describe('AnalysisReporter', () => {
	test('console report works with the real Logger instance', () => {
		const originalInfo = logger.info;
		const originalWarn = logger.warn;
		const originalError = logger.error;
		const lines = [];

		logger.info = (...args) => lines.push(args.join(' '));
		logger.warn = (...args) => lines.push(args.join(' '));
		logger.error = (...args) => lines.push(args.join(' '));

		try {
			const reporter = new AnalysisReporter({ logger, useColor: false });
			reporter.printConsoleReport(createAnalysisResult(), {
				verbose: false,
			});

			expect(lines.join('\n')).toContain('Summary');
		} finally {
			logger.info = originalInfo;
			logger.warn = originalWarn;
			logger.error = originalError;
		}
	});

	test('honors explicit json format even when output extension is not json', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');

		try {
			await reporter.writeReport(reportPath, createAnalysisResult(), {
				format: 'json',
			});

			const content = fs.readFileSync(reportPath, 'utf-8');
			const parsed = JSON.parse(content);

			expect(parsed).toMatchObject({
				type: 'report',
				command: 'analyze',
				status: 'ok',
				summary: {
					entryModule: 'main',
					entryPath: normalizeJsonPath(path.resolve('src/main.lua')),
					entryPackage: 'default',
					packages: [
						{
							name: 'default',
							root: normalizeJsonPath(path.resolve('src')),
						},
					],
					outputPath: normalizeJsonPath(path.resolve('dist/out.lua')),
					missingPolicy: 'error',
					fallbackPolicy: 'external-only',
				},
				metrics: {
					durationMs: 1,
				},
				alerts: [],
			});
			expect(parsed.sections).toBeUndefined();
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('json report marks explicit runtime externals in dependency graph and externals section', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.success = true;
		analysis.externals = [
			{
				id: '@default/dkjson',
				moduleName: 'dkjson',
				packageName: 'default',
				localModuleId: 'dkjson',
				canonicalModuleId: '@default/dkjson',
				filePath: null,
				isExternal: true,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: false,
				isMissing: false,
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: 'dkjson',
						moduleName: 'dkjson',
						packageName: 'default',
						localModuleId: 'dkjson',
						canonicalModuleId: '@default/dkjson',
						filePath: null,
						isExternal: true,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
						isMissing: false,
					},
				],
			],
		]);

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
				verbose: true,
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(parsed.alerts).toEqual([]);
			expect(Object.keys(parsed.sections)).toEqual([
				'externals',
				'ignoredModules',
				'modulesByPackage',
				'dependencyGraph',
			]);
			expect(parsed.sections.externals).toEqual([
				expect.objectContaining({
					id: '@default/dkjson',
					name: 'dkjson',
					status: 'runtime',
				}),
			]);
			expect(parsed.sections.ignoredModules).toEqual([]);
			expect(parsed.sections.dependencyGraph.main || []).toEqual([
				expect.objectContaining({
					id: 'dkjson',
					name: 'dkjson',
					type: 'external',
					status: 'runtime',
				}),
			]);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('json report keeps missing alerts first-class without duplicating generic errors', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.success = false;
		analysis.missing = [
			{
				requireId: 'sdk.logger',
				moduleName: 'sdk.logger',
				packageName: 'default',
				localModuleId: 'sdk.logger',
				canonicalModuleId: '@default/sdk.logger',
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				fatal: true,
				message: 'Module not found: sdk.logger',
				code: 'MODULE_NOT_FOUND',
			},
		];
		analysis.errors = [new Error('Module not found: sdk.logger')];

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

			expect(parsed.status).toBe('failed');
			expect(parsed.alerts).toEqual([
				expect.objectContaining({
					type: 'missing',
					severity: 'error',
					message: 'Module not found.',
					requireId: 'sdk.logger',
					name: 'sdk.logger',
					dependencyType: 'module',
					ruleApplied: false,
				}),
			]);
			expect(parsed.alerts).not.toContainEqual(
				expect.objectContaining({
					type: 'error',
					message: 'Module not found: sdk.logger',
				})
			);
			expect(parsed.sections).toBeUndefined();
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('json report does not treat missing externals as runtime externals', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.success = true;
		analysis.missing = [
			{
				requireId: 'dkjson',
				moduleName: 'dkjson',
				packageName: 'default',
				localModuleId: 'dkjson',
				canonicalModuleId: '@default/dkjson',
				filePath: null,
				requiredBy: 'main',
				isExternal: true,
				ruleApplied: false,
				overrideApplied: false,
				message: 'Module not found.',
				fatal: false,
			},
		];

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(parsed.metrics.externalCount).toBe(0);
			expect(parsed.sections).toBeUndefined();

			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
				verbose: true,
			});

			const verboseParsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(verboseParsed.sections.externals).toEqual([]);
			expect(verboseParsed.sections.ignoredModules).toEqual([]);
			expect(verboseParsed.summary.entryPath).toBe(
				normalizeJsonPath(path.resolve('src/main.lua'))
			);
			expect(verboseParsed.sections.modulesByPackage).toEqual({});
			expect(JSON.stringify(verboseParsed)).not.toContain('\\');
			expect(verboseParsed.alerts).toEqual([
				expect.objectContaining({
					type: 'missing',
					dependencyType: 'external',
					name: 'dkjson',
					ruleApplied: false,
				}),
			]);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
				format: 'json',
	test('json report includes ignored dependencies in dependency graph', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: '@default/legacy',
						moduleName: 'legacy',
						packageName: 'default',
						localModuleId: 'legacy',
						canonicalModuleId: '@default/legacy',
						filePath: null,
						isExternal: false,
						isIgnored: true,
						isMissing: false,
						ruleApplied: true,
						overrideApplied: false,
					},
				],
			],
		]);

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
				verbose: true,
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(parsed.sections.ignoredModules).toEqual([
				expect.objectContaining({
					id: '@default/legacy',
					name: 'legacy',
					packageName: 'default',
					localModuleId: 'legacy',
				}),
			]);
			expect(parsed.sections.dependencyGraph.main || []).toEqual([
				expect.objectContaining({
					id: '@default/legacy',
					name: 'legacy',
					status: 'ignored',
					ruleApplied: true,
				}),
			]);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('preserves detailed missing-module messages in text reports', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.missing = [
			{
				requireId: 'sdk.logger',
				moduleName: 'sdk.logger',
				packageName: 'default',
				localModuleId: 'sdk.logger',
				canonicalModuleId: '@default/sdk.logger',
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				fatal: true,
				message: 'Override path for module \'sdk.logger\' not found: ./vendor/logger.lua',
			},
		];

		try {
			await reporter.writeReport(reportPath, analysis);

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain("@default/main -> sdk.logger: Override path for module 'sdk.logger' not found: ./vendor/logger.lua");
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('text reports do not duplicate missing-module failures in the errors section', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.success = false;
		analysis.missing = [
			{
				requireId: 'sdk.logger',
				moduleName: 'sdk.logger',
				packageName: 'default',
				localModuleId: 'sdk.logger',
				canonicalModuleId: '@default/sdk.logger',
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				fatal: true,
				message: 'Module not found: sdk.logger',
			},
		];
		analysis.errors = [new Error('Module not found: sdk.logger')];

		try {
			await reporter.writeReport(reportPath, analysis);

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('Missing Modules');
			expect(content).toContain('@default/main -> sdk.logger: Module not found');
			expect(content).not.toContain('\nErrors\n------\n- Module not found: sdk.logger');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('text reports render packages in multiline layout for readability', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.context.packages = [
			{
				name: 'sdk',
				root: path.resolve('external_modules/sdk/very/long/path/for/testing'),
				isEntry: false,
			},
			{
				name: 'default',
				root: path.resolve('src'),
				isEntry: true,
			},
		];
		analysis.modules = [
			{
				id: 'main',
				moduleName: 'main',
				packageName: 'default',
				localModuleId: 'main',
				canonicalModuleId: '@default/main',
				filePath: path.resolve('src/main.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@sdk/logger',
				moduleName: 'logger',
				packageName: 'sdk',
				localModuleId: 'logger',
				canonicalModuleId: '@sdk/logger',
				filePath: path.resolve('external_modules/sdk/src/logger.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
		];

		try {
			await reporter.writeReport(reportPath, analysis, { format: 'text' });

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('Lua Pack 2.0.0 - Analysis Mode\n\nSummary');
			expect(content).toContain('Analysis Result: success');
			expect(content).toContain('Packages: 2\n  - default\n  - sdk');
			expect(content).toContain('Modules: 0');
			expect(content).not.toContain('[Missing Modules]');
			expect(content).toContain('Missing Action: error');
			expect(content).toContain('Missing: 0');
			expect(content).toContain('Ignored: 0');
			expect(content).not.toContain('\nPackages\n');
			expect(content).not.toContain('\nExternals\n');
			expect(content).not.toContain('external_modules/sdk/very/long/path/for/testing');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('dependency graph marks cycles and non-recursive dependencies without duplicating cyclic roots', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.context.packages = [
			{
				name: 'default',
				root: path.resolve('src'),
				isEntry: true,
			},
			{
				name: 'libA',
				root: path.resolve('lib/libA'),
				isEntry: false,
			},
		];
		analysis.modules = [
			{
				id: 'main',
				moduleName: 'main',
				packageName: 'default',
				localModuleId: 'main',
				canonicalModuleId: '@default/main',
				filePath: path.resolve('src/main.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@libA/init',
				moduleName: 'libA',
				packageName: 'libA',
				localModuleId: 'init',
				canonicalModuleId: '@libA/init',
				filePath: path.resolve('lib/libA/init.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@libA/src.sub',
				moduleName: 'libA.src.sub',
				packageName: 'libA',
				localModuleId: 'src.sub',
				canonicalModuleId: '@libA/src.sub',
				filePath: path.resolve('lib/libA/src/sub.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@libA/not_recursive',
				moduleName: 'libA.not_recursive',
				packageName: 'libA',
				localModuleId: 'not_recursive',
				canonicalModuleId: '@libA/not_recursive',
				filePath: path.resolve('lib/libA/not_recursive.lua'),
				isExternal: false,
				ruleApplied: true,
				overrideApplied: false,
				analyzeDependencies: false,
				isMissing: false,
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: '@libA/init',
						moduleName: 'libA',
						packageName: 'libA',
						localModuleId: 'init',
						canonicalModuleId: '@libA/init',
						filePath: path.resolve('lib/libA/init.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
			[
				'@libA/init',
				[
					{
						id: '@libA/src.sub',
						moduleName: 'libA.src.sub',
						packageName: 'libA',
						localModuleId: 'src.sub',
						canonicalModuleId: '@libA/src.sub',
						filePath: path.resolve('lib/libA/src/sub.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
			[
				'@libA/src.sub',
				[
					{
						id: '@libA/init',
						moduleName: 'libA',
						packageName: 'libA',
						localModuleId: 'init',
						canonicalModuleId: '@libA/init',
						filePath: path.resolve('lib/libA/init.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
					{
						id: '@libA/not_recursive',
						moduleName: 'libA.not_recursive',
						packageName: 'libA',
						localModuleId: 'not_recursive',
						canonicalModuleId: '@libA/not_recursive',
						filePath: path.resolve('lib/libA/not_recursive.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: true,
						overrideApplied: false,
					},
				],
			],
			['@libA/not_recursive', []],
		]);

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('[libA]');
			expect(content).toContain('@libA/init\n└─ @libA/src.sub');
			expect(content).toContain('├─ @libA/init (circular)');
			expect(content).toContain('└─ @libA/not_recursive (non-recursive)');
			expect(content).not.toContain('\n@libA/src.sub\n├─ @libA/init');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('dependency graph assigns stable numbered refs to repeated modules', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.context.packages = [
			{
				name: 'lib',
				root: path.resolve('lib'),
				isEntry: false,
			},
		];
		analysis.modules = [
			{
				id: '@lib/root',
				moduleName: 'lib.root',
				packageName: 'lib',
				localModuleId: 'root',
				canonicalModuleId: '@lib/root',
				filePath: path.resolve('lib/root.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@lib/a',
				moduleName: 'lib.a',
				packageName: 'lib',
				localModuleId: 'a',
				canonicalModuleId: '@lib/a',
				filePath: path.resolve('lib/a.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@lib/b',
				moduleName: 'lib.b',
				packageName: 'lib',
				localModuleId: 'b',
				canonicalModuleId: '@lib/b',
				filePath: path.resolve('lib/b.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: '@lib/shared.assert',
				moduleName: 'lib.shared.assert',
				packageName: 'lib',
				localModuleId: 'shared.assert',
				canonicalModuleId: '@lib/shared.assert',
				filePath: path.resolve('lib/shared/assert.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'@lib/root',
				[
					{
						id: '@lib/a',
						moduleName: 'lib.a',
						packageName: 'lib',
						localModuleId: 'a',
						canonicalModuleId: '@lib/a',
						filePath: path.resolve('lib/a.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
					{
						id: '@lib/b',
						moduleName: 'lib.b',
						packageName: 'lib',
						localModuleId: 'b',
						canonicalModuleId: '@lib/b',
						filePath: path.resolve('lib/b.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
			[
				'@lib/a',
				[
					{
						id: '@lib/shared.assert',
						moduleName: 'lib.shared.assert',
						packageName: 'lib',
						localModuleId: 'shared.assert',
						canonicalModuleId: '@lib/shared.assert',
						filePath: path.resolve('lib/shared/assert.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
			[
				'@lib/b',
				[
					{
						id: '@lib/shared.assert',
						moduleName: 'lib.shared.assert',
						packageName: 'lib',
						localModuleId: 'shared.assert',
						canonicalModuleId: '@lib/shared.assert',
						filePath: path.resolve('lib/shared/assert.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
			['@lib/shared.assert', []],
		]);

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('@lib/shared.assert [#1]');
			expect(content).toContain('@lib/shared.assert -> #1');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('text reports group circular dependencies separately without duplicating them in generic errors', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();
		const cycleError = new Error(
			'Circular dependency detected: @default/main -> @default/lib -> @default/main'
		);
		cycleError.code = 'CIRCULAR_DEPENDENCY';

		analysis.success = false;
		analysis.errors = [cycleError];

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('[Circular Dependencies]');
			expect(content).toContain('@default/main -> @default/lib -> @default/main');
			expect(content).not.toContain('Circular dependency detected:');
			expect(content).not.toContain('[Errors]\n\n- Circular dependency detected:');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('verbose text reports include explicit Externals and Alerts sections in stable order', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.missing = [
			{
				requireId: 'missing.module',
				moduleName: 'missing.module',
				packageName: 'default',
				localModuleId: 'missing.module',
				canonicalModuleId: '@default/missing.module',
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				fatal: true,
				message: 'Module not found: missing.module',
			},
		];
		analysis.externals = [
			{
				id: '@default/dkjson',
				moduleName: 'dkjson',
				packageName: 'default',
				localModuleId: 'dkjson',
				canonicalModuleId: '@default/dkjson',
				filePath: null,
				isExternal: true,
				ruleApplied: true,
				overrideApplied: false,
				analyzeDependencies: false,
				isMissing: false,
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: '@default/dkjson',
						moduleName: 'dkjson',
						packageName: 'default',
						localModuleId: 'dkjson',
						canonicalModuleId: '@default/dkjson',
						filePath: null,
						isExternal: true,
						isMissing: false,
						isIgnored: false,
						ruleApplied: true,
						overrideApplied: false,
					},
				],
			],
		]);
		analysis.warnings = ['sample warning'];

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');
			const packagesIdx = content.indexOf('\nPackages\n');
			const externalsIdx = content.indexOf('\nExternals\n');
			const alertsIdx = content.indexOf('\nAlerts\n');
			const ignoredIdx = content.indexOf('\nIgnored\n');
			const dependencyGraphIdx = content.indexOf('\nDependency Graph\n');

			expect(externalsIdx).toBeGreaterThan(-1);
			expect(alertsIdx).toBeGreaterThan(-1);
			expect(packagesIdx).toBeGreaterThan(-1);
			expect(alertsIdx).toBeLessThan(packagesIdx);
			expect(packagesIdx).toBeLessThan(externalsIdx);
			expect(ignoredIdx).toBe(-1);
			expect(dependencyGraphIdx).toBeGreaterThan(-1);
			expect(externalsIdx).toBeLessThan(dependencyGraphIdx);
			expect(content).toContain('@default/dkjson');
			const missingModIdx = content.indexOf('[Missing Modules]');
			const warningsIdx = content.indexOf('[Warnings]');
			expect(missingModIdx).toBeGreaterThan(-1);
			expect(warningsIdx).toBeGreaterThan(-1);
			expect(missingModIdx).toBeLessThan(warningsIdx);
			expect(content).toContain('Missing Action: error');
			expect(content).toContain('Externals: 1');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('verbose text reports include dependency graph and omit package module details', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.modules = [
			{
				id: '@sdk/logger',
				moduleName: 'logger',
				packageName: 'sdk',
				localModuleId: 'logger',
				canonicalModuleId: '@sdk/logger',
				filePath: path.resolve('external_modules/sdk/src/logger.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
			{
				id: 'main',
				moduleName: 'main',
				packageName: 'default',
				localModuleId: 'main',
				canonicalModuleId: '@default/main',
				filePath: path.resolve('src/main.lua'),
				isExternal: false,
				ruleApplied: false,
				overrideApplied: false,
				analyzeDependencies: true,
				isMissing: false,
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: '@sdk/logger',
						moduleName: 'logger',
						packageName: 'sdk',
						localModuleId: 'logger',
						canonicalModuleId: '@sdk/logger',
						filePath: path.resolve('external_modules/sdk/src/logger.lua'),
						isExternal: false,
						isMissing: false,
						isIgnored: false,
						ruleApplied: false,
						overrideApplied: false,
					},
				],
			],
		]);

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).toContain('Dependency Graph');
			expect(content).toContain('default');
			expect(content).toContain('sdk');
			expect(content).toContain('@default/main');
			expect(content).toContain('@sdk/logger');
			expect(content).not.toContain('Package Module Details');
			expect(content).not.toContain('path:');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('text reports omit empty externals section when no external modules exist', async () => {
		const reporter = new AnalysisReporter({ packageVersion: '2.0.0' });
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'text',
				verbose: true,
			});

			const content = fs.readFileSync(reportPath, 'utf-8');

			expect(content).not.toContain('\nExternals\n');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
});
