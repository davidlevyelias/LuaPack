# LuaPack Examples

The `examples/demo` directory contains a single, feature-rich Lua project that exercises most LuaPack capabilities. Different `*.luapack.config.json` files toggle behaviours such as external resolution, obfuscation, and missing-module handling while using the same source tree.

## Available Configurations

- `basic.luapack.config.json` – Runs `src/main.lua`, showcasing local modules, analytics helpers, and reporting utilities.
- `obfuscation.luapack.config.json` – Bundles the analytics entry with internal obfuscation (minify, rename, ASCII) enabled.
- `external.luapack.config.json` – Demonstrates `modules.external` paths and overrides by loading SDK utilities and a stub `dkjson` parser from `external_modules/`.
- `ignore-missing.luapack.config.json` – Shows how `modules.ignoreMissing` records unresolved modules without aborting the build.

Each config writes its bundle to the shared `dist/` folder with a descriptive file name.

## Running a Scenario

From the repository root:

```pwsh
# Inspect the dependency graph first (optional but recommended)
node index.js --config examples/demo/basic.luapack.config.json --analyze --verbose

# Produce one of the bundles
node index.js --config examples/demo/basic.luapack.config.json

# Execute the generated Lua script
lua .\dist\demo_basic_bundle.lua
```

Swap the config file for `obfuscation`, `external`, or `ignore-missing` to explore each scenario.
