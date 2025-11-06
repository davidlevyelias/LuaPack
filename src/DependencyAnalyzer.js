const fs = require('fs');
const path = require('path');
const ModuleResolver = require('./ModuleResolver');

class DependencyAnalyzer {
    constructor(sourceRoot) {
        this.resolver = new ModuleResolver(sourceRoot);
        this.visited = new Set();
    }

    buildDependencyGraph(entryFile) {
        const graph = new Map();
        this.visited.clear();
        this._buildGraph(entryFile, graph);
        return graph;
    }

    _buildGraph(filePath, graph) {
        if (this.visited.has(filePath)) {
            return;
        }
        this.visited.add(filePath);

        const content = fs.readFileSync(filePath, 'utf-8');
        const dependencies = this._findDependencies(content);

        const resolvedDependencies = dependencies.map(dep => this.resolver.resolve(dep, path.dirname(filePath)));

        graph.set(filePath, { dependencies: resolvedDependencies });

        for (const depPath of resolvedDependencies) {
            this._buildGraph(depPath, graph);
        }
    }

    _findDependencies(content) {
        const requireRegex = /require\s*\(['"]([\w\.\/]+)['"]\)/g;
        const dependencies = [];
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        return dependencies;
    }

    topologicalSort(graph) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (filePath) => {
            if (visiting.has(filePath)) {
                throw new Error(`Circular dependency detected: ${filePath}`);
            }
            if (visited.has(filePath)) {
                return;
            }

            visiting.add(filePath);

            const node = graph.get(filePath);
            if (node) {
                for (const dep of node.dependencies) {
                    visit(dep);
                }
            }

            visiting.delete(filePath);
            visited.add(filePath);
            sorted.push(filePath);
        };

        for (const filePath of graph.keys()) {
            if (!visited.has(filePath)) {
                visit(filePath);
            }
        }

        return sorted;
    }
}

module.exports = DependencyAnalyzer;
