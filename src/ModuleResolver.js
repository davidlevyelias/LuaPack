const fs = require('fs');
const path = require('path');

class ModuleResolver {
    constructor(sourceRoot) {
        this.sourceRoot = sourceRoot;
    }

    resolve(requirePath, currentDir) {
        // Convert dot notation to path separators
        const pathFromRequire = requirePath.replace(/\./g, path.sep);

        // Try resolving relative to the current file's directory
        let resolvedPath = path.resolve(currentDir, pathFromRequire);
        if (this.tryPath(resolvedPath)) {
            return this.tryPath(resolvedPath);
        }

        // Try resolving relative to the source root
        resolvedPath = path.resolve(this.sourceRoot, pathFromRequire);
        if (this.tryPath(resolvedPath)) {
            return this.tryPath(resolvedPath);
        }

        throw new Error(`Module not found: ${requirePath}`);
    }

    tryPath(basePath) {
        // Check for .lua extension
        if (fs.existsSync(`${basePath}.lua`)) {
            return `${basePath}.lua`;
        }
        // Check for /init.lua
        if (fs.existsSync(path.join(basePath, 'init.lua'))) {
            return path.join(basePath, 'init.lua');
        }
        return null;
    }
}

module.exports = ModuleResolver;
