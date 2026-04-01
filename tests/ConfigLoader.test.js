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
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.entry).toBe(path.resolve(tempDir, 'src/main.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'dist/out.lua'));
		expect(config.sourceRoot).toBe(path.resolve(tempDir, 'src'));
		expect(config.schemaVersion).toBe(2);
		expect(config._configVersion).toBe('v1');
		expect(config._v2).toMatchObject({
			schemaVersion: 2,
			entry: path.resolve(tempDir, 'src/main.lua'),
			output: path.resolve(tempDir, 'dist/out.lua'),
			modules: {
				roots: [path.resolve(tempDir, 'src')],
				env: ['LUA_PATH'],
				missing: 'error',
			},
			bundle: {
				mode: 'runtime',
				fallback: 'external-only',
			},
		});
	});

	test('derives default output when omitted', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			sourceRoot: './src',
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.entry).toBe(path.resolve(tempDir, 'src/main.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'src/main_packed.lua'));
		expect(config._v2.output).toBe(path.resolve(tempDir, 'src/main_packed.lua'));
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
			entry: './examples/demo/src/main.lua',
			output: './dist/cli.lua',
			sourceroot: './examples/demo/src',
		});

		expect(config.entry).toBe(
			path.resolve(PROJECT_ROOT, 'examples/demo/src/main.lua')
		);
		expect(config.output).toBe(path.resolve(PROJECT_ROOT, 'dist/cli.lua'));
		expect(config.sourceRoot).toBe(
			path.resolve(PROJECT_ROOT, 'examples/demo/src')
		);
		expect(config._v2.modules.roots[0]).toBe(
			path.resolve(PROJECT_ROOT, 'examples/demo/src')
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
		expect(config._v2.modules.rules['my.module']).toEqual({
			mode: 'bundle',
			path: path.resolve(tempDir, 'vendor/my/module.lua'),
			recursive: false,
		});
	});

	test('loads schemaVersion 2 configuration and exposes compatibility facade', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/v2.lua',
			modules: {
				roots: ['./src', './vendor'],
				env: ['SDK_PATH'],
				missing: 'warn',
				rules: {
					dkjson: {
						mode: 'bundle',
						path: './vendor/dkjson.lua',
						recursive: false,
					},
					socket: {
						mode: 'external',
					},
				},
			},
			bundle: {
				mode: 'typed',
				fallback: 'never',
			},
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config._configVersion).toBe('v2');
		expect(config.sourceRoot).toBe(path.resolve(tempDir, 'src'));
		expect(config.modules.external.paths).toEqual([
			path.resolve(tempDir, 'vendor'),
		]);
		expect(config.modules.external.env).toEqual(['SDK_PATH']);
		expect(config.modules.ignoreMissing).toBe(true);
		expect(config._v2.modules.rules.dkjson).toEqual({
			mode: 'bundle',
			path: path.resolve(tempDir, 'vendor/dkjson.lua'),
			recursive: false,
		});
		expect(config._v2.modules.rules.socket).toEqual({
			mode: 'external',
			recursive: true,
		});
		expect(config._v2.bundle).toEqual({
			mode: 'typed',
			fallback: 'never',
		});
	});

	test('warns and ignores v1 obfuscation settings', () => {
		const warnings = [];
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			output: './dist/out.lua',
			obfuscation: {
				tool: 'internal',
				config: {
					minify: true,
					renameVariables: true,
					ascii: true,
				},
			},
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({
			config: configPath,
			onWarning: (message) => warnings.push(message),
		});

		expect(config._warnings).toHaveLength(1);
		expect(warnings[0]).toMatch(/removed in LuaPack v2/);
		expect(config).not.toHaveProperty('obfuscation');
	});

	test('warns and ignores obfuscation CLI toggles', () => {
		const warnings = [];
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			entry: './src/main.lua',
			output: './dist/out.lua',
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({
			config: configPath,
			minify: true,
			renameVariables: true,
			onWarning: (message) => warnings.push(message),
		});

		expect(config._warnings).toHaveLength(1);
		expect(warnings[0]).toMatch(/Obfuscation settings are ignored/);
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
