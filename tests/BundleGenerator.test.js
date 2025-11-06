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
});
