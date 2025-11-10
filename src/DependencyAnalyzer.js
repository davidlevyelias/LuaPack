const fs = require('fs');
const path = require('path');
const ModuleResolver = require('./ModuleResolver');

class DependencyAnalyzer {
	constructor(config) {
		this.config = config;
		this.resolver = new ModuleResolver(config);
		this.visited = new Set();
		this.missingRecords = [];
		this.errors = [];
	}

	buildDependencyGraph(entryFile) {
		const graph = new Map();
		this.visited.clear();
		this.missingRecords = [];
		this.errors = [];

		const entryModule = this.resolver.createEntryRecord(entryFile);
		this._buildGraph(entryModule, graph);

		return {
			graph,
			entryModule,
			missing: [...this.missingRecords],
			errors: [...this.errors],
		};
	}

	_buildGraph(moduleRecord, graph) {
		if (!moduleRecord || moduleRecord.isIgnored || !moduleRecord.filePath) {
			return;
		}

		if (this.visited.has(moduleRecord.filePath)) {
			return;
		}
		this.visited.add(moduleRecord.filePath);

		const shouldAnalyze = moduleRecord.analyzeDependencies !== false;

		if (!shouldAnalyze) {
			graph.set(moduleRecord.filePath, {
				module: moduleRecord,
				dependencies: [],
			});
			return;
		}

		const fileContent = fs.readFileSync(moduleRecord.filePath, 'utf-8');
		const requires = this._findDependencies(fileContent);

		const resolvedDependencies = [];
		for (const requireId of requires) {
			let resolved;
			try {
				resolved = this.resolver.resolve(
					requireId,
					path.dirname(moduleRecord.filePath)
				);
			} catch (error) {
				if (error && error.code === 'MODULE_NOT_FOUND') {
					const missingRecord = this.resolver.createMissingRecord(requireId);
					this.missingRecords.push({
						requiredBy: moduleRecord,
						requireId,
						record: missingRecord,
						error,
						fatal: !this.resolver.ignoreMissing,
					});
					if (!this.resolver.ignoreMissing) {
						this.errors.push(error);
					}
					resolvedDependencies.push(missingRecord);
					continue;
				}
				throw error;
			}

			if (resolved.isIgnored) {
				continue;
			}

			if (resolved.isMissing) {
				this.missingRecords.push({
					requiredBy: moduleRecord,
					requireId,
					record: resolved,
					error: resolved.missingError || null,
					fatal: false,
				});
				resolvedDependencies.push(resolved);
				continue;
			}

			resolvedDependencies.push(resolved);
		}

		graph.set(moduleRecord.filePath, {
			module: moduleRecord,
			dependencies: resolvedDependencies,
		});

		for (const dependency of resolvedDependencies) {
			this._buildGraph(dependency, graph);
		}
	}

	_findDependencies(content) {
		const requireRegex = /require\s*\(\s*['"]([\w\.\/-]+)['"]\s*\)/g;
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
					if (dep.filePath) {
						visit(dep.filePath);
					}
				}
			}

			visiting.delete(filePath);
			visited.add(filePath);
			if (node && node.module) {
				sorted.push(node.module);
			}
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
