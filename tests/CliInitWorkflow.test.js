const fs = require('fs');
const os = require('os');
const path = require('path');

const { runInitWorkflow } = require('../src/cli/workflows');
const logger = require('../src/utils/Logger');

describe('CLI init workflow', () => {
	const originalInfo = logger.info;

	beforeEach(() => {
		logger.info = jest.fn();
	});

	afterEach(() => {
		logger.info = originalInfo;
		jest.clearAllMocks();
	});

	test('writes a versioned schema URL into generated config output', async () => {
		const targetDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'luapack-init-workflow-')
		);
		const configPath = path.join(targetDir, 'luapack.config.json');

		try {
			await runInitWorkflow(
				{
					yes: true,
					force: true,
					entry: './src/main.lua',
					output: './dist/out.lua',
					root: './src',
					luaVersion: '5.3',
					file: configPath,
				},
				'2.1.0'
			);

			const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
			expect(parsed.$schema).toBe(
				'https://raw.githubusercontent.com/davidlevyelias/LuaPack/v2.1.0/config.schema.json'
			);
		} finally {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
	});
});