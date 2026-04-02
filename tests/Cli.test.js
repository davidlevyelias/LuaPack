const {
	createProgram,
	parseEnvOption,
	parseLogLevel,
} = require('../src/index');

describe('CLI', () => {
	test('does not expose obfuscation flags in the command surface', () => {
		const cli = createProgram(async () => {});
		const optionFlags = cli.options.map((option) => option.long);

		expect(cli.description()).toBe('A modern Lua bundler and analyzer.');
		expect(optionFlags).not.toContain('--rename-variables');
		expect(optionFlags).not.toContain('--minify');
		expect(optionFlags).not.toContain('--ascii');
	});

	test('parses env option as a trimmed list and supports explicit disable', () => {
		expect(parseEnvOption('LUA_PATH, LUA_CPATH')).toEqual([
			'LUA_PATH',
			'LUA_CPATH',
		]);
		expect(parseEnvOption('')).toEqual([]);
		expect(parseEnvOption(undefined)).toBeUndefined();
	});

	test('rejects env option entries with empty items', () => {
		expect(() => parseEnvOption('LUA_PATH,,CUSTOM_PATH')).toThrow(
			'Expected a comma-separated list of non-empty environment variable names'
		);
	});

	test('accepts only supported log levels', () => {
		expect(parseLogLevel('DEBUG')).toBe('debug');
		expect(() => parseLogLevel('trace')).toThrow(
			'Expected one of: error, warn, info, debug'
		);
	});

	test('passes parsed CLI values into the action handler', async () => {
		const action = jest.fn().mockResolvedValue(undefined);
		const cli = createProgram(action);

		await cli.parseAsync([
			'node',
			'luapack',
			'main.lua',
			'--env',
			'LUA_PATH, LUA_CPATH',
			'--log-level',
			'debug',
			'--analyze',
			'--verbose',
		]);

		expect(action).toHaveBeenCalledWith(
			'main.lua',
			expect.objectContaining({
				analyze: true,
				env: ['LUA_PATH', 'LUA_CPATH'],
				logLevel: 'debug',
				verbose: true,
			}),
			expect.any(Object)
		);
	});

	test('fails parsing when log-level is invalid', async () => {
		const cli = createProgram(async () => {});
		cli.exitOverride();

		await expect(
			cli.parseAsync([
				'node',
				'luapack',
				'main.lua',
				'--log-level',
				'trace',
			])
		).rejects.toMatchObject({
			code: 'commander.invalidArgument',
		});
	});
});