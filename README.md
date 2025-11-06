# LuaPack

LuaPack is a Node.js command-line tool that bundles Lua projects into a single distributable script. It walks your Lua dependency graph, inlines the modules in execution order, and optionally obfuscates the output to keep your runtime footprint small and difficult to reverse-engineer.

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

- `-o, --output <file>`: Override the bundled output path.
- `-c, --config <file>`: Point to a `luapack.config.json` file.
- `--sourceroot <path>`: Set the root directory used when resolving `require` statements.
- `--obfuscation <tool>`: Override the obfuscation tool (`internal` or `none`).

Display full help with:

```bash
luapack --help
```

## Configuration

Advanced features live in `luapack.config.json`. The schema is documented in `config.schema.json`; a minimal example looks like:

```json
{
  "entry": "./examples/core/main.lua",
  "output": "./dist/example.lua",
  "sourceRoot": "./examples",
  "modules": {
    "ignore": ["socket.core"],
    "overrides": {
      "dkjson": { "path": "./vendor/dkjson.lua" }
    },
    "external": {
      "enabled": true,
      "recursive": false,
      "paths": ["./lua_modules"]
    }
  },
  "obfuscation": {
    "tool": "internal",
    "config": {
      "minify": true,
      "renameVariables": true,
      "ascii": false
    }
  }
}
```

When both CLI flags and config values are supplied, CLI flags win. The loader validates the merged result against `config.schema.json` before bundling so invalid settings fail fast.

## Obfuscation Pipeline

The internal obfuscation tool supports three layers:

1. **Minification** (`minify`): Runs `lua-format` in minify mode.
2. **Identifier renaming** (`renameVariables`): Renames locals/globals for a smaller surface area.
3. **ASCII encoding** (`ascii`): Emits modules as ASCII byte arrays that are decoded at runtime.

Enable the features you need through `obfuscation.config`. External obfuscators can be plugged in by setting `obfuscation.tool` to `none` and post-processing the bundle yourself.

## Development

- Run tests: `npm test`
- Format code: `npx prettier --write .`
- Example build: `npm run pack:example`

The test suite covers the configuration loader, dependency analysis pipeline, bundle generator, and ASCII obfuscator so you can iterate with confidence.

## License

MIT
