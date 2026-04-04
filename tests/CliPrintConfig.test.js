jest.mock('../src/config/ConfigLoader', () => ({
	loadConfig: jest.fn(),
}));

jest.mock('../src/analysis/AnalysisPipeline', () => {
	return jest.fn().mockImplementation(() => ({
		run: jest.fn(() => ({ success: true })),
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

describe('CLI print-config', () => {
	const originalWrite = process.stdout.write;
	let writes;

	beforeEach(() => {
		writes = [];
		process.stdout.write = jest.fn((chunk) => {
			writes.push(String(chunk));
			return true;
		});

		loadConfig.mockReturnValue({
			_v2: {
				schemaVersion: 2,
				entry: 'entry.lua',
				output: 'out.lua',
				modules: {
					roots: ['src'],
					env: [],
					missing: 'error',
					rules: {},
				},
				bundle: {
					mode: 'runtime',
					fallback: 'external-only',
				},
				_compat: {
					externalRecursive: true,
				},
			},
		});
	});

	afterEach(() => {
		process.stdout.write = originalWrite;
		jest.clearAllMocks();
	});

	test('analyze prints normalized config and exits before analysis', async () => {
		await runAnalyzeWorkflow('main.lua', { printConfig: true, output: 'report.txt' }, '1.0.0');

		expect(loadConfig).toHaveBeenCalledTimes(1);
		expect(writes.join('')).toContain('"schemaVersion": 2');
		expect(writes.join('')).toContain('"entry": "entry.lua"');
	});

	test('bundle prints normalized config and exits before bundling', async () => {
		await runBundleWorkflow('main.lua', { printConfig: true }, '1.0.0');

		expect(loadConfig).toHaveBeenCalledTimes(1);
		expect(writes.join('')).toContain('"output": "out.lua"');
	});
});