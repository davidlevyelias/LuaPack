const fs = require('fs');
const os = require('os');
const path = require('path');

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
	printBundleFailed: jest.fn(),
	printConfigSnapshot: jest.fn(),
	printReportSuccess: jest.fn(),
}));

const { loadConfig } = require('../src/config/ConfigLoader');
const { printCliHeader, printReportSuccess } = require('../src/cli/output');
const { runAnalyzeWorkflow } = require('../src/cli/workflows');
const logger = require('../src/utils/Logger');

function createAnalysisResult() {
	return {
		success: false,
		durationMs: 1,
		entryModule: {
			id: 'main',
			moduleName: 'main',
			packageName: 'default',
			localModuleId: 'main',
			canonicalModuleId: '@default/main',
			filePath: 'src/main.lua',
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
		missing: [
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
			packages: [
				{
					name: 'default',
					root: 'src',
				},
			],
			entryPath: 'src/main.lua',
			outputPath: 'dist/out.lua',
			luaVersion: '5.3',
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

describe('CLI analyze json output', () => {
	const originalWrite = process.stdout.write;
	const originalInfo = logger.info;
	let writes;

	beforeEach(() => {
		writes = [];
		process.stdout.write = jest.fn((chunk) => {
			writes.push(String(chunk));
			return true;
		});
		logger.info = jest.fn();

		loadConfig.mockReturnValue({
			schemaVersion: 2,
			entry: 'src/main.lua',
			output: 'dist/out.lua',
			luaVersion: '5.3',
			missing: 'error',
			packages: {
				default: {
					root: 'src',
					dependencies: {},
					rules: {},
				},
			},
			bundle: {
				fallback: 'external-only',
			},
			_internal: {
				entryPackage: 'default',
				entryKind: 'package-module',
			},
		});
	});

	afterEach(() => {
		process.stdout.write = originalWrite;
		logger.info = originalInfo;
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
			alerts: [
				expect.objectContaining({
					type: 'missing',
					message: 'Module not found.',
				}),
			],
			summary: {
				luaVersion: '5.3',
				missingPolicy: 'error',
			},
		});
		expect(printCliHeader).not.toHaveBeenCalled();
		expect(printReportSuccess).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	test('defaults analyze file output to text when no explicit format is provided', async () => {
		const targetDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-analyze-report-')
		);
		const reportPath = path.join(targetDir, 'report.txt');

		try {
			await expect(
				runAnalyzeWorkflow('main.lua', { output: reportPath }, '1.0.0')
			).resolves.toBeUndefined();

			expect(printReportSuccess).toHaveBeenCalledWith(
				expect.stringMatching(/report\.txt$/),
				{ useColor: undefined }
			);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});

	test('prints text through the logger when format is text', async () => {
		const logged = [];
		const originalInfo = logger.info;
		logger.info = jest.fn((...args) => {
			logged.push(args.join(' '));
		});

		try {
			await runAnalyzeWorkflow('main.lua', { format: 'text' }, '1.0.0');
		} finally {
			logger.info = originalInfo;
		}

		expect(logged.join('\n')).toContain('Lua Pack 1.0.0 - Analysis Mode');
		expect(logged.join('\n')).toContain('Summary');
		expect(printCliHeader).not.toHaveBeenCalled();
	});
});
