# LuaPack Examples

Each subfolder under `examples/` is a standalone scenario with its own `luapack.config.json` and source tree. Use these projects to experiment with different resolver and bundling features.

## Directory Overview

- `basic/` – Friendly starter project without obfuscation. Demonstrates local module resolution, nested directories, and a simple bundle target.
- `obfuscation/` – Same workflow as `basic`, but enables the internal obfuscation pipeline with minification, ASCII encoding, and custom rename bounds.
- `ignore-missing/` – Shows how `modules.ignoreMissing` records missing modules during analysis while still producing a bundle.
- `external/` – Resolves a module from an additional search path via `modules.external.paths`.

## Running an Example

From the repository root:

```pwsh
# 1. Run analysis (optional but recommended)
node index.js --config examples/basic/luapack.config.json --analyze --verbose

# 2. Produce the bundle
node index.js --config examples/basic/luapack.config.json

# 3. Execute the generated Lua script
lua .\dist\basic_bundle.lua
```

Swap `basic` for `obfuscation`, `ignore-missing`, or `external` to try other scenarios. The generated bundles are written to `dist/` and named after the example.
