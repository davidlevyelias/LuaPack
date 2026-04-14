# LuaPack

LuaPack is a Node.js command-line tool for analyzing Lua dependency graphs and producing a single distributable runtime bundle. It follows explicit `require` statements, resolves modules through declared package roots and local rules, and emits a self-contained runtime artifact.

## Features

- Resolves static `require` statements starting from an entry Lua file.
- Builds dependency analysis output in text or JSON form.
- Generates self-contained runtime bundles with controlled fallback behavior.
- Supports package-scoped dependency policies and local module rules.
- Supports configurable Lua grammar/runtime targets: `5.1`, `5.2`, `5.3`, and `LuaJIT`.
- Validates configuration against the canonical v2 schema before execution.

## Installation

LuaPack currently requires Node.js 20.12.0 or newer.

```bash
npm install @davidlevyelias/luapack
```

## CLI Usage

The CLI is exposed through the `luapack` binary.

```bash
luapack <command> [entry] [options]
```

Available commands:

- `luapack bundle [entry]`: Analyze the dependency graph and emit a bundle.
- `luapack analyze [entry]`: Analyze the dependency graph and print or write a report.
- `luapack init`: Generate a `luapack.config.json` file interactively.

Common options:

- `-c, --config <file>`: Point to a `luapack.config.json` file.
- `-o, --output <file>`: Override the bundle path or report path.
- `--root <path>`: Override the default package root for the current run.
- `--lua-version <version>`: Override the Lua version used for parsing and runtime targeting: `5.1`, `5.2`, `5.3`, or `LuaJIT`.
- `--missing <policy>`: Missing-module policy: `error` or `warn`.
- `--fallback <policy>`: Runtime fallback policy: `never`, `external-only`, or `always`.
- `--print-config`: Print the effective normalized v2 config and exit.
- `--no-color`: Disable ANSI color output.
- `--quiet`: Suppress informational CLI output.
- `--verbose`: Include verbose dependency details in report output.
- `--format <format>`: Visual output format: `text` or `json`.
- `--report <file>` (bundle): Write bundle analysis report to a file.
- `--report-format <format>` (bundle): File report format: `text` or `json`.
- `--log-level <level>`: Adjust logger verbosity (`error`, `warn`, `info`, `debug`).

Examples:

```bash
# Generate a config file interactively
luapack init

# Build a small runtime bundle from config
luapack bundle --config examples/simple/basic.luapack.config.json

# Inspect a small missing-module report
luapack analyze --config examples/simple/missing-warn.luapack.config.json --verbose

# Inspect the effective normalized config without running analysis or bundling
luapack bundle --config examples/simple/basic.luapack.config.json --print-config
```

Display full help with:

```bash
luapack --help
```

When `--format json` is used, command-line usage failures are emitted as a machine-readable JSON payload instead of mixed help text. This applies to parse-time issues such as invalid option values.

## Configuration (`luapack.config.json`)

LuaPack now accepts only the canonical v2 configuration format. Every config file must declare `schemaVersion: 2`. The loader validates the file against `config.schema.json`, then applies supported CLI overrides.

Minimal example:

```json
{
	"$schema": "https://raw.githubusercontent.com/davidlevyelias/LuaPack/v2.1.0/config.schema.json",
	"schemaVersion": 2,
	"entry": "./src/main.lua",
	"output": "./dist/app.bundle.lua",
	"luaVersion": "5.3",
	"packages": {
		"default": {
			"root": "./src"
		}
	}
}
```

- `$schema`: Optional JSON Schema URL for editor integration. `luapack init` writes a versioned schema URL so generated configs stay pinned to the installed LuaPack release instead of following the mutable `main` branch.
- `schemaVersion`: Must be `2`.
- `entry`: Entry Lua file.
- `output`: Optional output path. Defaults to `<entry-name>_packed.lua` alongside the entry file.
- `luaVersion`: Optional Lua version used for both dependency parsing and the runtime target. Supported values are `5.1`, `5.2`, `5.3`, and `LuaJIT`. Defaults to `5.3`.
- `missing`: Optional global missing-module policy.
- `packages.default.root`: Root directory for the default package. If omitted, LuaPack uses the entry file directory.

Lua 5.4 is not currently supported because the active parser backend does not support it.

### `packages`

```json
{
	"missing": "warn",
	"packages": {
		"default": {
			"root": "./src",
			"dependencies": {
				"sdk": {
					"mode": "external"
				}
			},
			"rules": {
				"socket.core": {
					"mode": "ignore"
				},
				"dkjson": {
					"mode": "bundle",
					"path": "./vendor/dkjson.lua",
					"recursive": false
				}
			}
		},
		"sdk": {
			"root": "./external_modules/sdk"
			}
		}
	}
}
```

- `missing`: Global missing-module policy.
- `packages`: Declared package scopes keyed by Lua require prefix.
- `dependencies`: Per-package dependency policy for other declared packages.
- `rules`: Local-module policy keyed by module identifier inside the package.

Each dependency supports:

- `mode: "bundle"`: Include modules from that package in the bundle.
- `mode: "external"`: Treat that package as runtime-provided.
- `mode: "ignore"`: Skip that package entirely.
- `recursive: false`: Resolve the package entry module but skip dependency traversal below it.

Each local rule supports:

- `mode: "bundle"`: Include the module in the bundle.
- `mode: "external"`: Treat the module as runtime-provided.
- `mode: "ignore"`: Skip the module entirely.
- `path`: Override the resolved module path.
- `recursive: false`: Resolve the module but skip dependency traversal below it.

### `bundle`

```json
{
	"bundle": {
		"fallback": "never"
	}
}
```

- `fallback`: `never`, `external-only`, or `always`.


## Breaking Change

LuaPack v1 configuration is no longer supported. Legacy fields such as `sourceRoot`, `modules.external`, `modules.overrides`, `modules.ignoreMissing`, `--sourceroot`, and `--ignore-missing` have been removed from the active config and CLI surface. Public v2 configs should now use top-level `missing` and `packages` instead of a `modules` block.



## Development

- **Format code**: `npx prettier --write .`
- **Run simple example build**: `npm run example:simple:bundle`
- **Run simple example analysis**: `npm run example:simple:analyze`
- **Run tests**: `npm test`

The test suite covers the configuration loader, dependency analysis pipeline, bundle generator, CLI workflows, and report generation.



## License

MIT
