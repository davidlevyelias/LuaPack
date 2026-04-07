const {
	createProgram,
	parseFallbackMode,
	parseLogLevel,
	parseMissingPolicy,
	parseReportFormat,
	runCli,
} = require('../src/index');

function exitOverrideRecursively(program) {
	program.exitOverride();
	program.commands.forEach((command) => command.exitOverride());
}

describe('CLI', () => {
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
	});

	test('does not expose removed legacy flags in the command surface', () => {
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

	test('accepts only supported fallback policies', () => {
		expect(parseFallbackMode('ALWAYS')).toBe('always');
		expect(() => parseFallbackMode('sometimes')).toThrow(
			'Expected one of: never, external-only, always'
		);
	});

	test('accepts only supported analyze report formats', () => {
		expect(parseReportFormat('JSON')).toBe('json');
		expect(() => parseReportFormat('yaml')).toThrow(
			'Expected one of: text, json'
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
			'--fallback',
			'always',
			'--no-color',
			'--quiet',
			'--print-config',
			'--log-level',
			'debug',
		]);

		expect(action).toHaveBeenCalledWith(
			'bundle',
			'main.lua',
			expect.objectContaining({
				color: false,
				command: 'bundle',
				envVar: ['LUA_PATH', 'LUA_CPATH'],
				fallback: 'always',
				logLevel: 'debug',
				missing: 'warn',
				printConfig: true,
				quiet: true,
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
			'--no-color',
			'--quiet',
			'--print-config',
			'--format',
			'json',
			'--verbose',
			'--output',
			'report.txt',
		]);

		expect(action).toHaveBeenCalledWith(
			'analyze',
			'main.lua',
			expect.objectContaining({
				color: false,
				command: 'analyze',
				format: 'json',
				output: 'report.txt',
				printConfig: true,
				quiet: true,
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

	test('runCli emits json command errors for analyze parse failures when json format is requested', async () => {
		await runCli([
			'node',
			'luapack',
			'analyze',
			'--format',
			'json',
			'--missing',
			'skip',
		]);

		expect(JSON.parse(writes.join(''))).toMatchObject({
			type: 'command-error',
			status: 'error',
			command: 'analyze',
			error: {
				type: 'usage',
				code: 'commander-invalidargument',
			},
		});
		expect(process.exitCode).toBe(1);
	});
});