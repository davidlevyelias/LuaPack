const fs = require('fs');
const path = require('path');
const luamin = require('lua-format/src/luamin.js');

class BundleGenerator {
    createBundleTemplate(modules, entryModule) {
        const moduleEntries = Object.entries(modules).map(([name, content]) => {
            return `["${name}"] = function(...)\n${content}\nend,`;
        }).join('\n');

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

    async generateBundle(entryFile, sortedModules, graph) {
        const modules = {};

        for (const filePath of sortedModules) {
            const moduleName = this.getModuleName(filePath);
            let content = fs.readFileSync(filePath, 'utf-8');

            const obfuscation = this.config.obfuscation || { tool: 'none', config: {} };
            if (obfuscation.tool === 'internal') {
                const { minify = false, renameVariables = false } = obfuscation.config || {};
                if (minify || renameVariables) {
                    const options = {};
                    if (renameVariables) {
                        options.RenameVariables = true;
                        options.RenameGlobals = true;
                    }
                    content = luamin.Minify(content, options);
                }
                // ASCII obfuscation will be handled in a later stage when the module is integrated.
            }

            modules[moduleName] = content;
        }

        const entryModuleName = this.getModuleName(entryFile);

        return this.createBundleTemplate(modules, entryModuleName);
    }

    getModuleName(filePath) {
        const relativePath = path.relative(this.config.sourceRoot, filePath);
        // remove .lua and replace path separators with dots
        return relativePath.replace(/\.lua$/, '').replace(/[\\\/]/g, '.');
    }
}

module.exports = BundleGenerator;