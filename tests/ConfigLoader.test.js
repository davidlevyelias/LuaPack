const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig } = require('../src/config/ConfigLoader');
const { getConfigWarnings } = require('../src/config/loader');

describe('ConfigLoader', () => {
	let tempDir;
	const originalCwd = process.cwd();

	function defaultPackageConfig() {
		return {
			default: {
				root: './src',
			},
		};
	}

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-test-'));
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('loads configuration from file and normalizes paths', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
				packages: defaultPackageConfig(),
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.entry).toBe(path.resolve(tempDir, 'src/main.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'dist/out.lua'));
		expect(config.schemaVersion).toBe(2);
		expect(config).toMatchObject({
			schemaVersion: 2,
			entry: path.resolve(tempDir, 'src/main.lua'),
			output: path.resolve(tempDir, 'dist/out.lua'),
			luaVersion: '5.3',
				missing: 'error',
				packages: {
					default: {
						root: path.resolve(tempDir, 'src'),
					},
			},
			bundle: {
				fallback: 'external-only',
			},
		});
	});

	test('applies CLI bundle overrides before normalization', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({
			config: configPath,
			fallback: 'never',
		});

		expect(config.bundle).toEqual({
			fallback: 'never',
		});
	});

	test('derives default output when omitted', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
				packages: defaultPackageConfig(),
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.entry).toBe(path.resolve(tempDir, 'src/main.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'src/main_packed.lua'));
		expect(config.output).toBe(path.resolve(tempDir, 'src/main_packed.lua'));
	});

	test('loads configured luaVersion and allows CLI override', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
			luaVersion: '5.1',
			packages: defaultPackageConfig(),
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const configured = loadConfig({ config: configPath });
		expect(configured.luaVersion).toBe('5.1');

		const overridden = loadConfig({
			config: configPath,
			luaVersion: 'LuaJIT',
		});
		expect(overridden.luaVersion).toBe('LuaJIT');
	});

	test('applies CLI overrides relative to cwd', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const cliSrcDir = path.join(tempDir, 'cli-project', 'src');
		fs.mkdirSync(cliSrcDir, { recursive: true });
		fs.writeFileSync(path.join(cliSrcDir, 'main.lua'), 'return {}\n');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
				packages: defaultPackageConfig(),
		};
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({
			config: configPath,
			entry: './cli-project/src/main.lua',
			output: './dist/cli.lua',
			root: './cli-project/src',
		});

		expect(config.entry).toBe(
			path.resolve(tempDir, 'cli-project/src/main.lua')
		);
		expect(config.output).toBe(path.resolve(tempDir, 'dist/cli.lua'));
		expect(config.packages.default.root).toBe(
			path.resolve(tempDir, 'cli-project/src')
		);
	});

	test('allows module overrides to disable recursion', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
				packages: {
					default: {
						root: './src',
						rules: {
							'my.module': {
								mode: 'bundle',
								path: './vendor/my/module.lua',
								recursive: false,
							},
						},
					},
				},
		};
		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

			expect(config.packages.default.rules['my.module']).toEqual({
			mode: 'bundle',
			path: path.resolve(tempDir, 'vendor/my/module.lua'),
			recursive: false,
		});
	});

	test('drops rule paths for external and ignore modes and records config warnings', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/out.lua',
			packages: {
				default: {
					root: './src',
					rules: {
						slaxml: {
							mode: 'external',
							path: './vendor/slaxml.lua',
						},
						legacy: {
							mode: 'ignore',
							path: './vendor/legacy.lua',
						},
					},
				},
			},
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

		expect(config.packages.default.rules.slaxml).toEqual({
			mode: 'external',
			recursive: true,
		});
		expect(config.packages.default.rules.legacy).toEqual({
			mode: 'ignore',
			recursive: true,
		});
		expect(getConfigWarnings(config)).toEqual([
			expect.stringContaining("rule 'default.slaxml' sets mode 'external'"),
			expect.stringContaining("rule 'default.legacy' sets mode 'ignore'"),
		]);
	});

	test('loads schemaVersion 2 configuration as canonical v2 config', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		const configContent = {
			schemaVersion: 2,
			entry: './src/main.lua',
			output: './dist/v2.lua',
				missing: 'warn',
				packages: {
					default: {
						root: './src',
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
					vendor: {
						root: './vendor',
						dependencies: {},
						rules: {},
					},
				},
			bundle: {
				fallback: 'never',
			},
		};

		fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

		const config = loadConfig({ config: configPath });

			expect(config.missing).toBe('warn');
			expect(config.packages.default.rules.dkjson).toEqual({
			mode: 'bundle',
			path: path.resolve(tempDir, 'vendor/dkjson.lua'),
			recursive: false,
		});
			expect(config.packages.default.rules.socket).toEqual({
			mode: 'external',
				recursive: true,
		});
			expect(config.packages.vendor.root).toBe(
				path.resolve(tempDir, 'vendor')
			);
		expect(config.bundle).toEqual({
			fallback: 'never',
		});
	});

	test('rejects configs without schemaVersion 2', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		fs.writeFileSync(
			configPath,
			JSON.stringify({ entry: './src/main.lua', output: './dist/out.lua' }, null, 2)
		);

		expect(() => loadConfig({ config: configPath })).toThrow(
			/v1 configuration is no longer supported/
		);
	});

	test('throws descriptive error for invalid configuration', () => {
		const configPath = path.join(tempDir, 'luapack.config.json');
		fs.writeFileSync(
			configPath,
			JSON.stringify({ schemaVersion: 2, output: './dist/out.lua' }, null, 2)
		);

		expect(() => loadConfig({ config: configPath })).toThrow(
			/Invalid configuration/
		);
	});
});
