const fs = require('fs');
const path = require('path');
const luaparse = require('luaparse');
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
					const missingRecord =
						this.resolver.createMissingRecord(requireId);
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
		const ast = luaparse.parse(content);
		const dependencies = [];
		this._collectDependenciesFromNode(ast, dependencies);
		return dependencies;
	}

	_collectDependenciesFromNode(node, dependencies) {
		if (!node || typeof node !== 'object') {
			return;
		}

		const dependency = this._extractRequireDependency(node);
		if (dependency) {
			dependencies.push(dependency);
		}

		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					this._collectDependenciesFromNode(item, dependencies);
				}
				continue;
			}

			this._collectDependenciesFromNode(value, dependencies);
		}
	}

	_extractRequireDependency(node) {
		if (!node || typeof node !== 'object') {
			return null;
		}

		const isDirectRequire =
			node.base &&
			node.base.type === 'Identifier' &&
			node.base.name === 'require';

		if (!isDirectRequire) {
			return null;
		}

		let argumentNode = null;
		if (node.type === 'CallExpression') {
			if (!Array.isArray(node.arguments) || node.arguments.length !== 1) {
				return null;
			}
			argumentNode = node.arguments[0];
		} else if (node.type === 'StringCallExpression') {
			argumentNode = node.argument;
		} else {
			return null;
		}

		if (!argumentNode || argumentNode.type !== 'StringLiteral') {
			return null;
		}

		const moduleId = this._decodeStringLiteral(argumentNode.raw).trim();
		if (!moduleId || !/^[\w\.\/-]+$/.test(moduleId)) {
			return null;
		}

		return moduleId;
	}

	_decodeStringLiteral(raw) {
		if (typeof raw !== 'string' || raw.length === 0) {
			return '';
		}

		if (
			(raw.startsWith('"') && raw.endsWith('"')) ||
			(raw.startsWith("'") && raw.endsWith("'"))
		) {
			return raw.slice(1, -1);
		}

		const longStringMatch = raw.match(/^\[(=*)\[([\s\S]*)\]\1\]$/);
		if (longStringMatch) {
			return longStringMatch[2];
		}

		return raw;
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
