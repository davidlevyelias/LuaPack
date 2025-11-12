const fs = require('fs');
const os = require('os');
const path = require('path');

const BundleGenerator = require('../src/BundleGenerator');
const LuaPacker = require('../src/LuaPacker');

function createTempLuaFile(content = 'return {}') {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luapack-bundle-'));
	const filePath = path.join(dir, 'main.lua');
	fs.writeFileSync(filePath, content);
	return { dir, filePath };
}

describe('BundleGenerator', () => {
	test('LuaPacker applies ASCII obfuscation after bundling', async () => {
		const { dir, filePath } = createTempLuaFile('return { value = 42 }');
		const outputPath = path.join(dir, 'bundle.lua');
		const config = {
			entry: filePath,
			output: outputPath,
			sourceRoot: dir,
			obfuscation: {
				tool: 'internal',
				config: { ascii: true },
			},
		};
		const packer = new LuaPacker(config);
		const moduleRecord = {
			moduleName: 'main',
			filePath,
			isIgnored: false,
			isExternal: false,
		};
		const analysisResult = {
			entryModule: moduleRecord,
			sortedModules: [moduleRecord],
			metrics: {},
		};

		try {
			await packer.pack(analysisResult);
			const bundle = fs.readFileSync(outputPath, 'utf-8');
			expect(bundle).toContain('string.char');
			expect(bundle).toContain('return __lp_chunk(...)');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
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
			expect(bundle).toContain(
				'local with_init = module_name .. ".init"'
			);
			expect(bundle).toContain('local original_require = require');
			expect(bundle).toContain(
				'local result = original_require(module_name)'
			);
			expect(bundle).toContain(
				'local resolved_name = resolve_module_name(module_name)'
			);
			expect(bundle).toContain('return require("packages.app.src", ...)');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('LuaPacker renames variables without minifying when minify disabled', async () => {
		const { dir, filePath } = createTempLuaFile(
			`local function module()
	    local value = 42
	    return value
	end

return module
`
		);
		const outputPath = path.join(dir, 'bundle.lua');
		const config = {
			entry: filePath,
			output: outputPath,
			sourceRoot: dir,
			obfuscation: {
				tool: 'internal',
				config: {
					minify: false,
					renameVariables: { enabled: true, min: 6, max: 9 },
				},
			},
		};
		const packer = new LuaPacker(config);
		const moduleRecord = {
			moduleName: 'main',
			filePath,
			isIgnored: false,
			isExternal: false,
		};
		const analysisResult = {
			entryModule: moduleRecord,
			sortedModules: [moduleRecord],
			metrics: {},
		};

		try {
			await packer.pack(analysisResult);
			const bundle = fs.readFileSync(outputPath, 'utf-8');
			expect(bundle).not.toContain(
				'Code generated using github.com/Herrtt/luamin.js'
			);
			expect(bundle).not.toMatch(/\bL_\d+_/);
			const declaredLocals = Array.from(
				bundle.matchAll(/^local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)
			).map((match) => match[1]);
			expect(declaredLocals.length).toBeGreaterThanOrEqual(3);
			for (const name of declaredLocals.slice(0, 5)) {
				expect(name.length).toBeGreaterThanOrEqual(6);
				expect(name.length).toBeLessThanOrEqual(9);
				expect(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)).toBe(true);
			}
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
