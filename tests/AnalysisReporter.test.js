const fs = require('fs');
const os = require('os');
const path = require('path');

const AnalysisReporter = require('../src/analysis/AnalysisReporter').default;

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
			filePath: path.resolve('src/main.lua'),
			isExternal: false,
			overrideApplied: false,
			analyzeDependencies: true,
			isMissing: false,
		},
		modules: [],
		externals: [],
		moduleById: new Map(),
		dependencyGraph: new Map(),
		sortedModules: [],
		topologicalOrder: [],
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
					roots: [normalizeJsonPath(path.resolve('src'))],
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

	test('json report suppresses missing alerts when missing policy is ignore', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.context.missingPolicy = 'ignore';
		analysis.success = true;
		analysis.missing = [
			{
				requireId: 'dkjson',
				moduleName: 'dkjson',
				filePath: null,
				requiredBy: 'main',
				isExternal: true,
				overrideApplied: false,
				fatal: false,
				message: 'Module not found.',
			},
		];
		analysis.dependencyGraph = new Map([
			[
				'main',
				[
					{
						id: 'dkjson',
						moduleName: 'dkjson',
						filePath: null,
						isExternal: true,
						overrideApplied: false,
						isMissing: true,
					},
				],
			],
		]);
		analysis.metrics.missingCount = 1;

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
				verbose: true,
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(parsed.alerts).toEqual([]);
			expect(parsed.metrics.missingCount).toBe(0);
			expect(parsed.sections.externals).toEqual([
				expect.objectContaining({
					id: 'dkjson',
					name: 'dkjson',
					status: 'missing',
				}),
			]);
			expect(parsed.sections.dependencyGraph.main || []).toEqual([
				expect.objectContaining({
					id: 'dkjson',
					name: 'dkjson',
					status: 'missing',
					type: 'external',
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
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
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

	test('json report includes missing externals in externals list when verbose', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.json');
		const analysis = createAnalysisResult();

		analysis.success = true;
		analysis.missing = [
			{
				requireId: 'dkjson',
				moduleName: 'dkjson',
				filePath: null,
				requiredBy: 'main',
				isExternal: true,
				overrideApplied: false,
				fatal: false,
				message: 'Module not found.',
			},
		];

		try {
			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
			});

			const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(parsed.metrics.externalCount).toBe(1);
			expect(parsed.sections).toBeUndefined();

			await reporter.writeReport(reportPath, analysis, {
				format: 'json',
				verbose: true,
			});

			const verboseParsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
			expect(verboseParsed.sections.externals).toEqual([
				expect.objectContaining({
					id: 'dkjson',
					name: 'dkjson',
					status: 'missing',
					ruleApplied: false,
				}),
			]);
			expect(verboseParsed.summary.entryPath).toBe(
				normalizeJsonPath(path.resolve('src/main.lua'))
			);
			expect(Array.isArray(verboseParsed.sections.modules)).toBe(true);
			expect(JSON.stringify(verboseParsed)).not.toContain('\\\\');
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

	test('preserves detailed missing-module messages in text reports', async () => {
		const reporter = new AnalysisReporter();
		const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-report-'));
		const reportPath = path.join(targetDir, 'analysis.txt');
		const analysis = createAnalysisResult();

		analysis.missing = [
			{
				requireId: 'sdk.logger',
				moduleName: 'sdk.logger',
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
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
				filePath: null,
				requiredBy: 'main',
				isExternal: false,
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
