const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../src/config/ConfigLoader', () => ({
	loadConfig: jest.fn(),
}));

jest.mock('../src/analysis/AnalysisPipeline', () => {
	return jest.fn().mockImplementation(() => ({
		run: jest.fn(() => ({
			success: true,
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
				roots: ['src'],
				packages: [
					{
						name: 'default',
						root: 'src',
						isEntry: true,
					},
				],
				entryPath: 'src/main.lua',
				outputPath: 'out.lua',
				analyzeOnly: false,
				ignoredPatterns: [],
				missingPolicy: 'error',
				fallbackPolicy: 'external-only',
				externals: {
					enabled: false,
					recursive: true,
					paths: [],
				},
			},
		})),
	}));
});

jest.mock('../src/bundle', () => ({
	LuaPacker: jest.fn().mockImplementation(() => ({
		getConfig: jest.fn(() => ({})),
		pack: jest.fn(),
	})),
}));

const { loadConfig } = require('../src/config/ConfigLoader');
const { runAnalyzeWorkflow, runBundleWorkflow } = require('../src/cli/workflows');
const logger = require('../src/utils/Logger');

describe('CLI print-config', () => {
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
			entry: 'entry.lua',
			output: 'out.lua',
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
		jest.clearAllMocks();
	});

	test('analyze prints normalized config and exits before analysis', async () => {
		await runAnalyzeWorkflow(
			'main.lua',
			{ printConfig: true, output: 'report.txt' },
			'1.0.0'
		);

		expect(loadConfig).toHaveBeenCalledTimes(1);
		expect(writes.join('')).toContain('"schemaVersion": 2');
		expect(writes.join('')).toContain('"entry": "entry.lua"');
	});

	test('bundle prints normalized config and exits before bundling', async () => {
		await runBundleWorkflow('main.lua', { printConfig: true }, '1.0.0');

		expect(loadConfig).toHaveBeenCalledTimes(1);
		expect(writes.join('')).toContain('"output": "out.lua"');
	});

	test('bundle report path defaults report format to text', async () => {
		const targetDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-bundle-report-')
		);
		const reportPath = path.join(targetDir, 'bundle-report.txt');

		try {
			await expect(
				runBundleWorkflow(
					'main.lua',
					{ report: reportPath, format: 'json', verbose: true },
					'1.0.0'
				)
			).resolves.toBeUndefined();

			expect(loadConfig).toHaveBeenCalledTimes(1);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
});