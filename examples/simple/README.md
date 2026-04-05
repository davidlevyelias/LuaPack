# LuaPack Simple Examples

The `examples/simple` directory contains small scenarios intended for fast live testing. Unlike the richer `examples/demo` project, each example here is minimal enough to make bundle output and analysis reports easy to inspect by hand.

## Available Configurations

- `basic.luapack.config.json` – Small runtime bundle with one local dependency chain.
- `missing-warn.luapack.config.json` – Small analysis case that intentionally leaves one dependency unresolved with `modules.missing: "warn"`.

## Running a Scenario

From the repository root:

```pwsh
# Build the simple runtime bundle
node build/index.js bundle --config examples/simple/basic.luapack.config.json

# Inspect missing-module reporting
node build/index.js analyze --config examples/simple/missing-warn.luapack.config.json --verbose
```