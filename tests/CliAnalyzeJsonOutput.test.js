jest.mock('../src/config/ConfigLoader', () => ({
	loadConfig: jest.fn(),
}));

jest.mock('../src/analysis/AnalysisPipeline', () => {
	return jest.fn().mockImplementation(() => ({
		run: jest.fn(() => createAnalysisResult()),
	}));
});

jest.mock('../src/bundle', () => ({
	LuaPacker: jest.fn().mockImplementation((config) => ({
		getConfig: jest.fn(() => config),
		pack: jest.fn(),
	})),
}));

jest.mock('../src/cli/output', () => ({
	printCliHeader: jest.fn(),
	printBundleSuccess: jest.fn(),
	printConfigSnapshot: jest.fn(),
	printReportSuccess: jest.fn(),
}));

const { loadConfig } = require('../src/config/ConfigLoader');
const { printCliHeader, printReportSuccess } = require('../src/cli/output');
const { runAnalyzeWorkflow } = require('../src/cli/workflows');

function createAnalysisResult() {
	return {
		success: false,
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
		topologicalOrder: [],
		missing: [
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
		],
		warnings: [],
		errors: [new Error('Module not found: sdk.logger')],
		metrics: {
			moduleCount: 1,
			externalCount: 0,
			missingCount: 1,
			moduleSizeSum: 100,
			estimatedBundleSize: 100,
			bundleSizeBytes: 0,
		},
		context: {
			rootDir: 'src',
			roots: ['src'],
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

describe('CLI analyze json output', () => {
	const originalWrite = process.stdout.write;
	let writes;

	beforeEach(() => {
		writes = [];
		process.stdout.write = jest.fn((chunk) => {
			writes.push(String(chunk));
			return true;
		});

		loadConfig.mockReturnValue({
			schemaVersion: 2,
			entry: 'src/main.lua',
			output: 'dist/out.lua',
			modules: {
				roots: ['src'],
				env: [],
				missing: 'error',
				rules: {},
			},
			bundle: {
				fallback: 'external-only',
			},
			_compat: {
				externalRecursive: true,
			},
		});
	});

	afterEach(() => {
		process.stdout.write = originalWrite;
		process.exitCode = undefined;
		jest.clearAllMocks();
	});

	test('prints json to stdout and suppresses header when format is json', async () => {
		await runAnalyzeWorkflow('main.lua', { format: 'json' }, '1.0.0');

		const parsed = JSON.parse(writes.join(''));
		expect(parsed).toMatchObject({
			type: 'report',
			command: 'analyze',
			status: 'failed',
			summary: {
				missingPolicy: 'error',
			},
		});
		expect(printCliHeader).not.toHaveBeenCalled();
		expect(printReportSuccess).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	test('rejects analyze output when no explicit format is provided', async () => {
		await expect(
			runAnalyzeWorkflow('main.lua', { output: 'report.json' }, '1.0.0')
		).rejects.toMatchObject({
			code: 'ANALYZE_OUTPUT_REQUIRES_FORMAT',
			errorType: 'usage',
		});
	});

	test('prints text to stdout when format is text', async () => {
		await runAnalyzeWorkflow('main.lua', { format: 'text' }, '1.0.0');

		expect(writes.join('')).toContain('Analysis Summary');
		expect(printCliHeader).not.toHaveBeenCalled();
	});
});
