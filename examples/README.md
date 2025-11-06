# LuaPack Examples

This folder contains a small self-contained Lua project that demonstrates how LuaPack resolves modules, bundles dependencies, and produces a single Lua script.

```
examples/
  README.md
  src/
    main.lua
    app/
      greeter.lua
    util/
      math.lua
    vendor/
      version.lua
```

- `main.lua` – entry point used in `examples/luapack.config.json`.
- `app/greeter.lua` – simple component that returns a greeting.
- `util/math.lua` – utility module that exposes arithmetic helpers.
- `vendor/version.lua` – simulates an external-style module bundled with the project.

To try it out:

```pwsh
cd path\to\LuaPack
node index.js --config examples/luapack.config.json
lua .\dist\example_packed.lua
```

The resulting bundle prints a greeting, the result of an addition, and the version string from the vendor module.
