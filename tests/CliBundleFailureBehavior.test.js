jest.mock('../src/config/ConfigLoader', () => ({
	loadConfig: jest.fn(),
}));

jest.mock('../src/analysis/AnalysisPipeline', () => {
	return jest.fn().mockImplementation(() => ({
		run: jest.fn(() => ({
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
						isEntry: true,
					},
				],
				entryPath: 'src/main.lua',
				outputPath: 'dist/out.lua',
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
const { runBundleWorkflow } = require('../src/cli/workflows');
const logger = require('../src/utils/Logger');

function createConfig() {
	return {
		schemaVersion: 2,
		entry: 'src/main.lua',
		output: 'dist/out.lua',
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
	};
}

describe('CLI bundle failure behavior', () => {
	const originalInfo = logger.info;
	let logs;

	beforeEach(() => {
		logs = [];
		logger.info = jest.fn((...args) => {
			logs.push(args.join(' '));
		});
		loadConfig.mockReturnValue(createConfig());
	});

	afterEach(() => {
		logger.info = originalInfo;
		process.exitCode = undefined;
		jest.clearAllMocks();
	});

	test('prints bundle failed footer and does not force exit code 1', async () => {
		await runBundleWorkflow(
			'main.lua',
			{ format: 'text', verbose: true, color: false },
			'1.0.0'
		);

		const output = logs.join('\n');
		expect(output).toContain('Bundle failed');
		expect(process.exitCode).toBeUndefined();
	});
});
