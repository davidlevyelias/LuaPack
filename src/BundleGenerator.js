const fs = require('fs');
const luamin = require('lua-format/src/luamin.js');
const AsciiObfuscator = require('./obfuscation/AsciiObfuscator');

class BundleGenerator {
	createBundleTemplate(modules, entryModule) {
		const moduleEntries = Object.entries(modules)
			.map(([name, content]) => {
				return `["${name}"] = function(...)\n${content}\nend,`;
			})
			.join('\n');

		return `
local modules = {
${moduleEntries}
}

local require_cache = {}

local function custom_require(module_name)
    if require_cache[module_name] then
        return require_cache[module_name]
    end

    if not modules[module_name] then
        error("Module '" .. module_name .. "' not found.")
    end

    local module_func = modules[module_name]
    local result = module_func()
    require_cache[module_name] = result
    return result
end

-- Set the global require to our custom require
require = custom_require

-- Run the entry module
require("${entryModule}")
`;
	}

	constructor(config) {
		this.config = config;
	}

	async generateBundle(entryModule, sortedModules) {
		const modules = {};

		for (const moduleRecord of sortedModules) {
			if (!moduleRecord.filePath) {
				continue;
			}

			const moduleName = moduleRecord.moduleName;
			let content = fs.readFileSync(moduleRecord.filePath, 'utf-8');

			const obfuscation = this.config.obfuscation || {
				tool: 'none',
				config: {},
			};
			let transformedContent = content;
			if (obfuscation.tool === 'internal') {
				const {
					minify = false,
					renameVariables = false,
					ascii = false,
				} = obfuscation.config || {};
				if (minify || renameVariables) {
					const options = {};
					if (renameVariables) {
						options.RenameVariables = true;
						options.RenameGlobals = true;
					}
					transformedContent = luamin.Minify(
						transformedContent,
						options
					);
				}

				if (ascii) {
					transformedContent = AsciiObfuscator.encode(
						transformedContent,
						moduleName
					);
				}
			}

			modules[moduleName] = transformedContent;
		}

		const entryModuleName = entryModule.moduleName;

		return this.createBundleTemplate(modules, entryModuleName);
	}
}

module.exports = BundleGenerator;
