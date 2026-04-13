# LuaPack Examples

For quick live testing, start with `examples/simple`. For a richer multi-feature project, use `examples/demo`.

## Example Sets

- `examples/simple` – Small, focused scenarios for fast bundle and report inspection.
- `examples/demo` – Larger shared-source scenarios covering the broader feature surface.

## Demo Set

The `examples/demo` directory contains a single Lua project exercised by multiple canonical v2 configs. Each config uses `schemaVersion: 2` and demonstrates a different resolver or fallback choice while sharing the same source tree.

## Available Configurations

- `basic.luapack.config.json` – Runs `src/main.lua`, showcasing local modules, analytics helpers, and reporting utilities.
- `external.luapack.config.json` – Demonstrates declared package roots and local rules by loading SDK utilities and a stub `dkjson` parser from `external_modules/`.
- `ignore-missing.luapack.config.json` – Shows how top-level `missing: "warn"` records unresolved modules without aborting the build.

Each config writes its bundle to the shared `dist/` folder with a descriptive file name.

## Running a Scenario

From the repository root:

```pwsh
# Inspect the dependency graph first (optional but recommended)
node build/index.js analyze --config examples/demo/basic.luapack.config.json --verbose

# Produce one of the bundles
node build/index.js bundle --config examples/demo/basic.luapack.config.json

# Execute the generated Lua script
lua .\dist\demo_basic_bundle.lua
```

Swap the config file for `external` or `ignore-missing` to explore each scenario.
