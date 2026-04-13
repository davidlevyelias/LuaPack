jest.mock('../src/cli/workflows', () => ({
	runAnalyzeWorkflow: jest.fn().mockResolvedValue(undefined),
	runBundleWorkflow: jest.fn().mockResolvedValue(undefined),
}));

const logger = require('../src/utils/Logger');
const { executeCliAction } = require('../src/cli/executeCliAction');
const {
	runAnalyzeWorkflow,
	runBundleWorkflow,
} = require('../src/cli/workflows');

describe('CLI execution', () => {
	const originalWrite = process.stdout.write;
	let writes;

	beforeEach(() => {
		writes = [];
		process.stdout.write = jest.fn((chunk) => {
			writes.push(String(chunk));
			return true;
		});
	});

	afterEach(() => {
		process.stdout.write = originalWrite;
		process.exitCode = undefined;
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

	test('analyze emits structured json errors when json format is requested', async () => {
		runAnalyzeWorkflow.mockRejectedValueOnce(
			Object.assign(new Error('Invalid configuration:\n- configuration root: must have required property \'entry\''), {
				code: 'CONFIG_INVALID',
				errorType: 'config',
			})
		);

		await executeCliAction('analyze', 'main.lua', { format: 'json' }, '1.0.0');

		expect(JSON.parse(writes.join(''))).toEqual({
			type: 'command-error',
			status: 'error',
			command: 'analyze',
			error: {
				type: 'config',
				code: 'config-invalid',
				message: 'Invalid configuration:',
				details: ['- configuration root: must have required property \'entry\''],
			},
		});
		expect(process.exitCode).toBe(1);
	});

	test('bundle emits structured json errors when json visual format is requested', async () => {
		runBundleWorkflow.mockRejectedValueOnce(
			Object.assign(new Error('Invalid configuration:\n- configuration root: must have required property \'entry\''), {
				code: 'CONFIG_INVALID',
				errorType: 'config',
			})
		);

		await executeCliAction(
			'bundle',
			'main.lua',
			{ format: 'json', reportFormat: 'text', report: 'bundle-report.txt' },
			'1.0.0'
		);

		expect(JSON.parse(writes.join(''))).toEqual({
			type: 'command-error',
			status: 'error',
			command: 'bundle',
			error: {
				type: 'config',
				code: 'config-invalid',
				message: 'Invalid configuration:',
				details: ['- configuration root: must have required property \'entry\''],
			},
		});
		expect(process.exitCode).toBe(1);
	});
});