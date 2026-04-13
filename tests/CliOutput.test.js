const AnalysisReporter = require('../src/analysis/AnalysisReporter').default;

function createAnalysisResult() {
	return {
		success: true,
		durationMs: 1,
		entryModule: {
			id: 'main',
			moduleName: 'main',
			filePath: 'src/main.lua',
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
			rootDir: 'src',
			entryPath: 'src/main.lua',
			outputPath: 'dist/out.lua',
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

describe('CLI output color control', () => {
	test('analysis reporter emits plain console text when color is disabled', () => {
		const lines = [];
		const reporter = new AnalysisReporter({
			useColor: false,
			logger: {
				info: (...args) => lines.push(args.join(' ')),
				warn: (...args) => lines.push(args.join(' ')),
				error: (...args) => lines.push(args.join(' ')),
			},
		});

		reporter.printSummary(createAnalysisResult());

		expect(lines.length).toBeGreaterThan(0);
		expect(lines.join('\n')).not.toMatch(/\u001b\[/);
		expect(lines.join('\n')).toContain('Output: dist/out.lua');
		expect(lines.join('\n')).toContain('Analysis Result: success');
		expect(lines.join('\n')).toContain('Missing Action: error');
	});
});