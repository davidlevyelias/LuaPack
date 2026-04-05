const fs = require('fs');
const os = require('os');
const path = require('path');

const AnalysisReporter = require('../src/analysis/AnalysisReporter').default;

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
			entryPath: path.resolve('src/main.lua'),
			outputPath: path.resolve('dist/out.lua'),
			analyzeOnly: true,
			ignoredPatterns: [],
			ignoreMissing: false,
			externals: {
				enabled: false,
				recursive: true,
				paths: [],
				env: {
					hasExplicitConfig: false,
					names: [],
					pathsByEnv: {},
					resolvedPaths: [],
					entries: [],
				},
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
				success: true,
				entry: 'main',
			});
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

			expect(content).toContain('main -> sdk.logger: Override path for module \'sdk.logger\' not found: ./vendor/logger.lua');
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
});