const fs = require('fs');
const luamin = require('lua-format/src/luamin.js');
const AsciiObfuscator = require('./obfuscation/AsciiObfuscator');

class BundleGenerator {
	createBundleTemplate(modules, entryModule) {
		const moduleEntries = Object.entries(modules)
			.map(([name, content]) => {
				return `["${name}"] = function(...)
${content}
end,`;
			})
			.join('\n');

		return `local modules = {
${moduleEntries}
}

local require_cache = {}
local original_require = require

local function resolve_module_name(module_name)
	if modules[module_name] then
		return module_name
	end

	if module_name:sub(-5) == ".init" then
		local parent = module_name:sub(1, -6)
		if parent ~= "" and modules[parent] then
			return parent
		end
	else
		local with_init = module_name .. ".init"
		if modules[with_init] then
			return with_init
		end
	end

	return nil
end

local function custom_require(module_name, ...)
	if require_cache[module_name] then
		return require_cache[module_name]
	end

	local resolved_name = resolve_module_name(module_name)
	if not resolved_name then
		if original_require then
			local result = original_require(module_name)
			require_cache[module_name] = result
			return result
		end
		error("Module '" .. module_name .. "' not found.")
	end

	if require_cache[resolved_name] then
		local cached = require_cache[resolved_name]
		require_cache[module_name] = cached
		return cached
	end

	local module_func = modules[resolved_name]
	local previous_require = require
	require = custom_require
	local result = module_func(...)
	require = previous_require
	require_cache[module_name] = result
	if module_name ~= resolved_name then
		require_cache[resolved_name] = result
	end
	return result
end

local function run_entry(...)
	local previous_require = require
	require = custom_require
	local result = custom_require("${entryModule}", ...)
	require = previous_require
	return result
end

run_entry(...)
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
