const path = require('path');
const fs = require('fs');
const DependencyAnalyzer = require('./DependencyAnalyzer');
const BundleGenerator = require('./BundleGenerator');

class LuaPacker {
    constructor(config) {
        this.config = this.normalizeConfig(config);
    }

    normalizeConfig(config) {
        const sourceRoot = config.sourceRoot ? path.resolve(config.sourceRoot) : path.dirname(path.resolve(config.entry));
        const defaultObfuscation = {
            tool: 'none',
            config: {
                minify: false,
                renameVariables: false,
                ascii: false,
            },
        };
        const incomingObfuscation = config.obfuscation || {};
        const mergedObfuscation = {
            ...defaultObfuscation,
            ...incomingObfuscation,
            config: {
                ...defaultObfuscation.config,
                ...(incomingObfuscation.config || {}),
            },
        };
        return {
            ...config,
            entry: path.resolve(config.entry),
            output: config.output ? path.resolve(config.output) : path.resolve('bundle.lua'),
            sourceRoot,
            obfuscation: mergedObfuscation,
        };
    }

    async pack() {
        console.log('Starting to pack...');
        console.log('Config:', this.config);

        const analyzer = new DependencyAnalyzer(this.config.sourceRoot);
        const graph = analyzer.buildDependencyGraph(this.config.entry);

        const sortedModules = analyzer.topologicalSort(graph);

        const generator = new BundleGenerator(this.config);
        const bundleContent = await generator.generateBundle(this.config.entry, sortedModules, graph);

        const outputDir = path.dirname(this.config.output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(this.config.output, bundleContent);

        console.log(`Bundle successfully created at: ${this.config.output}`);
    }
}

module.exports = LuaPacker;
