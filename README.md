# LuaPack

LuaPack is a Node.js command-line tool that bundles Lua projects into a single distributable script. It walks your Lua dependency graph, inlines the modules in execution order, and can optionally obfuscate the output to make it harder to reverse-engineer.
The packer follows explicit `require` statements and only includes `.lua` sources.

## Features

- Resolves `require` statements starting from an entry Lua file and builds a dependency graph.
- Generates a self-contained Lua bundle with a custom lightweight `require` loader.
- Honors module metadata such as ignore lists, overrides, and external module hints supplied through configuration.
- Integrates optional obfuscation via `lua-format` minification, symbol renaming, and ASCII string encoding.
- Validates configuration with JSON Schema so mistakes are caught before the bundle step.

## Installation

```bash
git clone https://github.com/your-org/luapack.git
cd luapack
npm install
```

## CLI Usage

The CLI is exposed through the `luapack` binary (also runnable with `node index.js`).

```bash
luapack [entry] [options]
```

Common options:

- `-o, --output <file>`: Override the bundle path (or report path when `--analyze` is used).
- `-c, --config <file>`: Point to a `luapack.config.json` file.
- `--sourceroot <path>`: Set the root directory used when resolving `require` statements.
- `--rename-variables [state]`: Toggle identifier renaming (`true`, `false`, `on`, `off`, etc.).
- `--minify [state]`: Toggle `lua-format` minification.
- `--ascii [state]`: Toggle ASCII byte-array encoding.
- `--analyze`: Skip bundling and emit the analysis report only.
- `--ignore-missing`: Continue even when modules cannot be resolved.
- `--env <vars>`: Comma-separated env variables to scan for external module paths (empty string disables).
- `--verbose`: Include dependency tree and topological order in the console report.
- `--log-level <level>`: Adjust logger verbosity (`error`, `warn`, `info`, `debug`).

When `--analyze` is supplied the pack step is skipped. Combine it with `--output` to write the report to disk, or with `--verbose` to expand the console output.

Display full help with:

```bash
luapack --help
```

## Configuration (`luapack.config.json`)

LuaPack uses a `luapack.config.json` file to manage complex bundling and obfuscation rules. The loader validates your configuration against `config.schema.json`, ensuring that all settings are correct before bundling begins. CLI flags will always override settings from the configuration file.

Below is a detailed breakdown of each section.



### Core Configuration

These are the fundamental properties needed to bundle your project.

```json
{
	"entry": "./examples/demo/src/main.lua",
	"output": "./dist/demo_basic_bundle.lua",
	"sourceRoot": "./examples/demo/src"
}
```

- **`entry`** (string, required): The path to the main Lua script that serves as the entry point for your application. Dependency analysis starts from this file.
- **`output`** (string, optional): The file path where the final bundled Lua script will be saved. If not set, the final packed file will be created at the same directory as the entry file and named as `<entry-filename>_packed.lua`.
- **`sourceRoot`** (string, optional): The root directory for your source files. When LuaPack encounters a `require("my.module")`, it resolves the path relative to this directory (e.g., `<sourceRoot>/my/module.lua`). If not set, the sourceRoot will default to the entry directory.



### Module Management (`modules`)

This section controls how LuaPack finds, includes, and excludes modules.

```json
{
	"modules": {
		"ignore": ["socket.core"],
		"external": {
			"enabled": true,
			"recursive": false,
			"paths": ["./lua_modules"],
			"env": ["LUA_PATH"]
		},
		"overrides": {
			"dkjson": {
				"path": "./vendor/dkjson.lua",
				"recursive": false
			}
		}
	}
}
```

- **`ignore`** (array of strings): A list of module names that should not be included in the bundle. This is useful for modules that are provided by the host environment (e.g., built-in libraries like `socket.core`).

- **`external`**: Configuration for modules that are not part of your project's source but are expected to be available in the runtime environment (e.g., installed via a package manager, like LuaRocks).
    - **`enabled`** (boolean): Set to `true` to enable external module resolution. Defaults to `false` when omitted.
    - **`recursive`** (boolean): If `true`, LuaPack will analyze the dependencies of external modules and try to include them in the final bundle. Defaults to `true` when `enabled` is on.
    - **`paths`** (array of strings): Optional directories LuaPack should search for external modules. Defaults to an empty list.
    - **`env`** (array of strings): Environment variables (for example `"LUA_PATH"`) that contain search paths. When this field is omitted, LuaPack inspects `LUA_PATH` automatically. Use an empty array to disable env lookups.

- **`overrides`** (object): A map where you can override specific settings per-module by its required name.
    - **`key`** (e.g., `"dkjson"`, `"src.app.moduleA"`): The module name being required.
    - **`path`** (string): The file path to use instead. If the module is not found at this override path it will be marked as missing.
        - **`recursive`** (boolean): If `false`, LuaPack will not analyze the dependencies of the overridden module, including it as-is. Default `true`.



### Obfuscation (`obfuscation`)

This section configures the optional obfuscation pipeline, which makes the code harder to read.
The current implementation does not aim to provide complex/advanced obfuscation techniques. For that, it is better to not use the internal tool and process the modules or packed bundle with an external, dedicated obfuscation tool. E.g: Hercules Obfuscator.

```json
{
	"obfuscation": {
		"tool": "internal",
		"config": {
			"minify": true,
			"renameVariables": {
				"enabled": true,
				"min": 5,
				"max": 5
			},
			"ascii": false
		}
	}
}
```

- **`tool`** (string): The obfuscation tool to use. Currently, only `"internal"` is supported. Set to `"none"` or omit to disable.

- **`config`**: A configuration object for the internal tool. The obfuscation layers are applied in a fixed order: 1. Rename, 2. Minify, 3. ASCII.
    - **`renameVariables`** (boolean or object): Renames local and global identifiers.
        - Set to `true` to enable with default settings (variable name length of 5).
        - Provide an object for fine-grained control:
            - `enabled` (boolean): Toggles the feature.
            - `min` (number): The minimum character length for renamed variables.
            - `max` (number): The maximum character length for renamed variables.
              Keep `min`/`max` at 3 or higher for any non-trivial bundle—very small ranges (such as `1`) limit the pool of unique identifiers and can cause the rename pass to fail.
    - **`minify`** (boolean): If `true`, runs the bundled code through `lua-format` to remove whitespace, comments, and unnecessary characters.
    - **`ascii`** (boolean): If `true`, encodes each module's source code into an ASCII byte array. The arrays are decoded back into Lua code at runtime, which can help evade simple static analysis.



## Development

- **Format code**: `npx prettier --write .`
- **Run example build**: `npm run pack:example`
- **Run tests**: `npm test`

The test suite covers the configuration loader, dependency analysis pipeline, bundle generator, and ASCII obfuscator so you can iterate with confidence.



## License

MIT
