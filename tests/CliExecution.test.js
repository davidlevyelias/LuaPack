jest.mock('../src/cli/workflows', () => ({
	runAnalyzeWorkflow: jest.fn().mockResolvedValue(undefined),
	runBundleWorkflow: jest.fn().mockResolvedValue(undefined),
}));

const logger = require('../src/Logger');
const { executeCliAction } = require('../src/cli/executeCliAction');
const {
	runAnalyzeWorkflow,
	runBundleWorkflow,
} = require('../src/cli/workflows');

describe('CLI execution', () => {
	afterEach(() => {
		logger.setLevel('info');
		jest.clearAllMocks();
	});

	test('quiet forces warn-level logging for analyze', async () => {
		logger.setLevel('debug');

		await executeCliAction('analyze', 'main.lua', { quiet: true, logLevel: 'debug' }, '1.0.0');

		expect(runAnalyzeWorkflow).toHaveBeenCalledWith(
			'main.lua',
			expect.objectContaining({ quiet: true, logLevel: 'debug' }),
			'1.0.0'
		);
		expect(logger.getLevel()).toBe('warn');
	});

	test('explicit log-level is still applied when quiet is not set', async () => {
		logger.setLevel('info');

		await executeCliAction('bundle', 'main.lua', { logLevel: 'debug' }, '1.0.0');

		expect(runBundleWorkflow).toHaveBeenCalledWith(
			'main.lua',
			expect.objectContaining({ logLevel: 'debug' }),
			'1.0.0'
		);
		expect(logger.getLevel()).toBe('debug');
	});

	test('print-config does not bypass command dispatch', async () => {
		await executeCliAction('analyze', 'main.lua', { printConfig: true }, '1.0.0');

		expect(runAnalyzeWorkflow).toHaveBeenCalledWith(
			'main.lua',
			expect.objectContaining({ printConfig: true }),
			'1.0.0'
		);
	});
});