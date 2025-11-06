#!/usr/bin/env node

const { program } = require('commander');
const LuaPacker = require('./src/LuaPacker');
const { loadConfig } = require('./src/config/ConfigLoader');

async function main() {
    program
    .version('0.3.0')
        .description('A modern Lua bundler and obfuscator.')
        .argument('[entry]', 'The entry Lua file.')
        .option('-o, --output <file>', 'The output bundled file.')
        .option('-c, --config <file>', 'Path to a luapack.config.json file.')
        .option('--sourceroot <path>', 'The root directory for resolving modules.')
        .option('--obfuscation <tool>', 'Override obfuscation tool (internal or none).')
        .action(async (entry, options) => {
            try {
                const config = loadConfig({
                    entry,
                    output: options.output,
                    sourceroot: options.sourceroot,
                    obfuscation: options.obfuscation,
                    config: options.config,
                });

                const packer = new LuaPacker(config);
                await packer.pack();
            } catch (error) {
                console.error(`An error occurred: ${error.message}`);
                process.exit(1);
            }
        });

    await program.parseAsync(process.argv);
}

main();
