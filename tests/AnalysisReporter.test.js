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

			expect(lines.join('\n')).toContain('Analysis Summary');
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
			expect(parsed.sections.externals).toEqual([
				expect.objectContaining({
					id: '@default/dkjson',
					name: 'dkjson',
					status: 'runtime',
				}),
			]);
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
		const reporter = new AnalysisReporter();
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

			expect(content).toContain("main -> sdk.logger: Override path for module 'sdk.logger' not found: ./vendor/logger.lua");
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('text reports do not duplicate missing-module failures in the errors section', async () => {
		const reporter = new AnalysisReporter();
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
			expect(content).toContain('main -> sdk.logger: Module not found: sdk.logger');
			expect(content).not.toContain('\nErrors\n------\n- Module not found: sdk.logger');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
});
