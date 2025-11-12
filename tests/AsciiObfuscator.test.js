const AsciiObfuscator = require('../src/obfuscation/AsciiObfuscator');

describe('AsciiObfuscator', () => {
	test('encodes Lua source into string.char chunks', () => {
		const encoded = AsciiObfuscator.encode('return 1', 'test.module');
		expect(encoded).toContain('string.char');
		expect(encoded).toContain('load');
		expect(encoded).toContain('return __lp_chunk(...)');
	});
});
