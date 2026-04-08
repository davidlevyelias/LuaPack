# LuaPack

LuaPack is a Node.js command-line tool for analyzing Lua dependency graphs and producing a single distributable runtime bundle. It follows explicit `require` statements, resolves modules through declared package roots and local rules, and emits a self-contained runtime artifact.

## Features

- Resolves static `require` statements starting from an entry Lua file.
- Builds dependency analysis output in text or JSON form.
- Generates self-contained runtime bundles with controlled fallback behavior.
- Supports package-scoped dependency policies and local module rules.
- Validates configuration against the canonical v2 schema before execution.

## Installation

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

Common options:

- `-c, --config <file>`: Point to a `luapack.config.json` file.
- `-o, --output <file>`: Override the bundle path or report path.
- `--root <path>`: Override the default package root for the current run.
- `--missing <policy>`: Missing-module policy: `error`, `warn`, or `ignore`.
- `--fallback <policy>`: Runtime fallback policy: `never`, `external-only`, or `always`.
- `--print-config`: Print the effective normalized v2 config and exit.
- `--no-color`: Disable ANSI color output.
- `--quiet`: Suppress informational CLI output.
- `--verbose`: Include dependency tree and topological order in the console report.
- `--format <format>`: Analysis report format: `text` or `json`.
- `--log-level <level>`: Adjust logger verbosity (`error`, `warn`, `info`, `debug`).

Examples:

```bash
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

## Configuration (`luapack.config.json`)

LuaPack now accepts only the canonical v2 configuration format. Every config file must declare `schemaVersion: 2`. The loader validates the file against `config.schema.json`, then applies supported CLI overrides.

Minimal example:

```json
{
	"schemaVersion": 2,
	"entry": "./src/main.lua",
	"output": "./dist/app.bundle.lua",
	"packages": {
		"default": {
			"root": "./src"
		}
	}
}
```

- `schemaVersion`: Must be `2`.
- `entry`: Entry Lua file.
- `output`: Optional output path. Defaults to `<entry-name>_packed.lua` alongside the entry file.
- `missing`: Optional global missing-module policy.
- `packages.default.root`: Root directory for the default package. If omitted, LuaPack uses the entry file directory.

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
