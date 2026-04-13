jest.mock('../src/config/ConfigLoader', () => ({
	loadConfig: jest.fn(),
}));

jest.mock('../src/cli/output', () => ({
	printCliHeader: jest.fn(),
	printBundleSuccess: jest.fn(),
	printBundleFailed: jest.fn(),
	printConfigSnapshot: jest.fn(),
	printReportSuccess: jest.fn(),
}));

const { loadConfig } = require('../src/config/ConfigLoader');
const { printCliHeader } = require('../src/cli/output');
const { runAnalyzeWorkflow } = require('../src/cli/workflows');

describe('CLI workflow validation order', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test('does not print the header when config loading fails', async () => {
		loadConfig.mockImplementation(() => {
			throw Object.assign(new Error('Configuration must specify an entry file.'), {
				code: 'ENTRY_REQUIRED',
				errorType: 'config',
			});
		});

		await expect(
			runAnalyzeWorkflow('main.lua', {}, '1.0.0')
		).rejects.toThrow('Configuration must specify an entry file.');

		expect(printCliHeader).not.toHaveBeenCalled();
	});
});