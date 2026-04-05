import fs from 'fs';
import path from 'path';

import ModuleResolver from './ModuleResolver';
import LuaRequireExtractor from './LuaRequireExtractor';
import type {
	AnalyzerDependencyGraph,
	DependencyAnalyzerResult,
	MissingDependencyRecord,
	ModuleRecord,
	WorkflowConfig,
} from './types';

export default class DependencyAnalyzer {
	private readonly resolver: ModuleResolver;
	private readonly extractor: LuaRequireExtractor;
	private readonly visited: Set<string>;
	private missingRecords: MissingDependencyRecord[];
	private errors: Error[];

	constructor(config: WorkflowConfig) {
		this.resolver = new ModuleResolver(config);
		this.extractor = new LuaRequireExtractor();
		this.visited = new Set<string>();
		this.missingRecords = [];
		this.errors = [];
	}

	buildDependencyGraph(entryFile: string): DependencyAnalyzerResult {
		const graph: AnalyzerDependencyGraph = new Map();
		this.visited.clear();
		this.missingRecords = [];
		this.errors = [];

		const entryModule = this.resolver.createEntryRecord(entryFile);
		this.buildGraph(entryModule, graph);

		return {
			graph,
			entryModule,
			missing: [...this.missingRecords],
			errors: [...this.errors],
		};
	}

	topologicalSort(graph: AnalyzerDependencyGraph): ModuleRecord[] {
		const sorted: ModuleRecord[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		const visit = (filePath: string) => {
			if (visiting.has(filePath)) {
				throw new Error(`Circular dependency detected: ${filePath}`);
			}
			if (visited.has(filePath)) {
				return;
			}

			visiting.add(filePath);
			const node = graph.get(filePath);
			if (node) {
				for (const dependency of node.dependencies) {
					if (dependency.filePath) {
						visit(dependency.filePath);
					}
				}
			}

			visiting.delete(filePath);
			visited.add(filePath);
			if (node?.module) {
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

	private buildGraph(moduleRecord: ModuleRecord, graph: AnalyzerDependencyGraph): void {
		if (!moduleRecord || moduleRecord.isIgnored || !moduleRecord.filePath) {
			return;
		}

		if (this.visited.has(moduleRecord.filePath)) {
			return;
		}
		this.visited.add(moduleRecord.filePath);

		if (moduleRecord.analyzeDependencies === false) {
			graph.set(moduleRecord.filePath, {
				module: moduleRecord,
				dependencies: [],
			});
			return;
		}

		const fileBuffer = fs.readFileSync(moduleRecord.filePath);
		const fileContent = fileBuffer.toString('utf-8');
		moduleRecord.sourceContent = fileContent;
		moduleRecord.sizeBytes = fileBuffer.byteLength;
		const requires = this.extractor.extract(fileContent);
		const resolvedDependencies: ModuleRecord[] = [];

		for (const requireId of requires) {
			let resolved: ModuleRecord;
			try {
				resolved = this.resolver.resolve(requireId, path.dirname(moduleRecord.filePath));
			} catch (error) {
				const typedError = error as Error & { code?: string };
				if (typedError?.code === 'MODULE_NOT_FOUND') {
					const missingRecord = this.resolver.createMissingRecordForRequire(
						requireId,
						typedError
					);
					this.missingRecords.push({
						requiredBy: moduleRecord,
						requireId,
						record: missingRecord,
						error: typedError,
						fatal: !this.resolver.ignoreMissing,
					});
					if (!this.resolver.ignoreMissing) {
						this.errors.push(typedError);
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
					error: resolved.missingError ?? null,
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
			this.buildGraph(dependency, graph);
		}
	}
}