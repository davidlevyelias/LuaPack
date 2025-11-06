const fs = require('fs');
const os = require('os');
const path = require('path');

const BundleGenerator = require('../src/BundleGenerator');

function createTempLuaFile(content = 'return {}') {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
	const filePath = path.join(dir, 'main.lua');
	fs.writeFileSync(filePath, content);
	return { dir, filePath };
}

describe('BundleGenerator', () => {
	test('applies ASCII obfuscation when enabled', async () => {
		const { dir, filePath } = createTempLuaFile('return { value = 42 }');
		const config = {
			sourceRoot: dir,
			obfuscation: {
				tool: 'internal',
				config: { ascii: true },
			},
		};

		const generator = new BundleGenerator(config);
		const moduleRecord = {
			moduleName: 'main',
			filePath,
			isIgnored: false,
		};
		const bundle = await generator.generateBundle(moduleRecord, [
			moduleRecord,
		]);

		expect(bundle).toContain('string.char');
		expect(bundle).toContain('return __lp_chunk(...)');
	});

	test('emits require shim that handles init aliases', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
		try {
			const initDir = path.join(dir, 'packages', 'app', 'src');
			fs.mkdirSync(initDir, { recursive: true });
			const initFile = path.join(initDir, 'init.lua');
			fs.writeFileSync(initFile, 'return { answer = 42 }\n');

			const config = {
				sourceRoot: dir,
				obfuscation: {
					tool: 'none',
					config: {},
				},
			};

			const generator = new BundleGenerator(config);
			const moduleRecord = {
				moduleName: 'packages.app.src',
				filePath: initFile,
				isIgnored: false,
			};
			const bundle = await generator.generateBundle(moduleRecord, [
				moduleRecord,
			]);

			expect(bundle).toContain('module_name:sub(-5) == ".init"');
			expect(bundle).toContain('local with_init = module_name .. ".init"');
			expect(bundle).toContain('local original_require = require');
			expect(bundle).toContain('local result = original_require(module_name)');
			expect(bundle).toContain('local resolved_name = resolve_module_name(module_name)');
			expect(bundle).toContain('run_entry(...)');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
