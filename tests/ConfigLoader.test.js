const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig } = require('../src/config/ConfigLoader');

const PROJECT_ROOT = path.resolve(__dirname, '..');

describe('ConfigLoader', () => {
	let tempDir;
	const originalCwd = process.cwd();

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-test-'));
		process.chdir(PROJECT_ROOT);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('loads configuration from file and normalizes paths', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			output: './dist/out.lua',
			sourceRoot: './src',
			obfuscation: {
				tool: 'internal',
				config: {
					minify: true,
					renameVariables: true,
					ascii: false,
				},
			},
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.entry).toBe(path.resolve(tempDir, 'src/main.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'dist/out.lua'));
		expect(config.sourceRoot).toBe(path.resolve(tempDir, 'src'));
		expect(config.obfuscation.tool).toBe('internal');
		expect(config.obfuscation.config).toEqual({
			minify: true,
			renameVariables: true,
			ascii: false,
		});
	});

	test('applies CLI overrides relative to cwd', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			output: './dist/out.lua',
		};
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({
			config: configPath,
			entry: './examples/src/main.lua',
			output: './dist/cli.lua',
			sourceroot: './examples/src',
		});

		expect(config.entry).toBe(
			path.resolve(PROJECT_ROOT, 'examples/src/main.lua')
		);
		expect(config.output).toBe(path.resolve(PROJECT_ROOT, 'dist/cli.lua'));
		expect(config.sourceRoot).toBe(
			path.resolve(PROJECT_ROOT, 'examples/src')
		);
	});

	test('allows module overrides to disable recursion', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			output: './dist/out.lua',
			modules: {
				overrides: {
					'my.module': {
						path: './vendor/my/module.lua',
						recursive: false,
					},
				},
			},
		};
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.modules.overrides['my.module'].recursive).toBe(false);
	});

	test('throws descriptive error for invalid configuration', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		fs.writeFileSync(
			configPath,
			JSON.stringify({ output: './dist/out.lua' }, null, 2)
		);

		expect(() => loadConfig({ config: configPath })).toThrow(
			/Invalid configuration/
		);
	});
});
