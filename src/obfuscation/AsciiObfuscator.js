class AsciiObfuscator {
	static encode(content, moduleName) {
		const codes = Array.from(content, (char) => char.charCodeAt(0));
		const chunkSize = 200;
		const chunks = [];

		for (let i = 0; i < codes.length; i += chunkSize) {
			const segment = codes.slice(i, i + chunkSize).join(', ');
			chunks.push(`string.char(${segment})`);
		}

		const sourceBuilder =
			chunks.length === 1
				? chunks[0]
				: `table.concat({ ${chunks.join(', ')} })`;

		return `local __lp_source = ${sourceBuilder}
local __lp_chunk = assert(load(__lp_source, "${moduleName}"))
return __lp_chunk(...)
`;
	}
}

module.exports = AsciiObfuscator;
