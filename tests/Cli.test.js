const {
	createProgram,
	parseBundleMode,
	parseFallbackMode,
	parseLogLevel,
	parseMissingPolicy,
} = require('../src/index');

function exitOverrideRecursively(program) {
	program.exitOverride();
	program.commands.forEach((command) => command.exitOverride());
}

describe('CLI', () => {
	test('does not expose obfuscation flags in the command surface', () => {
		const cli = createProgram(async () => {});
		const subcommands = cli.commands.map((command) => command.name());

		expect(cli.description()).toBe('A modern Lua bundler and analyzer.');
		expect(subcommands).toEqual(expect.arrayContaining(['bundle', 'analyze']));
		expect(subcommands).not.toContain('completion');
	});

	test('accepts only supported log levels', () => {
		expect(parseLogLevel('DEBUG')).toBe('debug');
		expect(() => parseLogLevel('trace')).toThrow(
			'Expected one of: error, warn, info, debug'
		);
	});

	test('accepts only supported missing policies', () => {
		expect(parseMissingPolicy('WARN')).toBe('warn');
		expect(() => parseMissingPolicy('skip')).toThrow(
			'Expected one of: error, warn, ignore'
		);
	});

	test('accepts only supported bundle modes and fallback policies', () => {
		expect(parseBundleMode('typed')).toBe('typed');
		expect(parseFallbackMode('ALWAYS')).toBe('always');
		expect(() => parseBundleMode('packed')).toThrow(
			'Expected one of: runtime, typed'
		);
		expect(() => parseFallbackMode('sometimes')).toThrow(
			'Expected one of: never, external-only, always'
		);
	});

	test('passes parsed bundle CLI values into the action handler', async () => {
		const action = jest.fn().mockResolvedValue(undefined);
		const cli = createProgram(action);

		await cli.parseAsync([
			'node',
			'luapack',
			'bundle',
			'main.lua',
			'--env-var',
			'LUA_PATH',
			'--env-var',
			'LUA_CPATH',
			'--root',
			'src',
			'--missing',
			'warn',
			'--mode',
			'typed',
			'--fallback',
			'always',
			'--log-level',
			'debug',
		]);

		expect(action).toHaveBeenCalledWith(
			'bundle',
			'main.lua',
			expect.objectContaining({
				command: 'bundle',
				envVar: ['LUA_PATH', 'LUA_CPATH'],
				fallback: 'always',
				logLevel: 'debug',
				missing: 'warn',
				mode: 'typed',
				root: ['src'],
			}),
		);
	});

	test('passes analyze-specific options into the action handler', async () => {
		const action = jest.fn().mockResolvedValue(undefined);
		const cli = createProgram(action);

		await cli.parseAsync([
			'node',
			'luapack',
			'analyze',
			'main.lua',
			'--verbose',
			'--output',
			'report.txt',
		]);

		expect(action).toHaveBeenCalledWith(
			'analyze',
			'main.lua',
			expect.objectContaining({
				command: 'analyze',
				output: 'report.txt',
				verbose: true,
			})
		);
	});

	test('fails parsing when log-level is invalid', async () => {
		const cli = createProgram(async () => {});
		exitOverrideRecursively(cli);

		await expect(
			cli.parseAsync([
				'node',
				'luapack',
				'bundle',
				'main.lua',
				'--log-level',
				'trace',
			])
		).rejects.toMatchObject({
			code: 'commander.invalidArgument',
		});
	});

	test('fails when no subcommand is provided', async () => {
		const cli = createProgram(async () => {});
		exitOverrideRecursively(cli);

		await expect(cli.parseAsync(['node', 'luapack'])).rejects.toMatchObject({
			code: 'luapack.subcommandRequired',
			exitCode: 2,
		});
	});
});