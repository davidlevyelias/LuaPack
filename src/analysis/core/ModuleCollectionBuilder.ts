import type {
	AnalyzerDependencyGraph,
	ModuleCollections,
	ModuleDependencyEdge,
	ModuleId,
	ModuleRecord,
} from '../types';

function isModuleRecord(value: unknown): value is ModuleRecord {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const record = value as Record<string, unknown>;
	return typeof record.id === 'string';
}

export function buildModuleCollections(graph: AnalyzerDependencyGraph): ModuleCollections {
	const moduleMap = new Map<ModuleId, ModuleRecord>();
	const dependencyGraph = new Map<ModuleId, ModuleDependencyEdge[]>();

	for (const node of graph.values()) {
		if (!node?.module || !isModuleRecord(node.module)) {
			continue;
		}

		const moduleRecord = node.module;
		moduleMap.set(moduleRecord.id, moduleRecord);

		const dependencies: ModuleDependencyEdge[] = [];
		for (const dependency of node.dependencies ?? []) {
			if (!dependency || !isModuleRecord(dependency)) {
				continue;
			}

			const dependencyRecord = dependency;
			dependencies.push({
				id: dependencyRecord.id,
				moduleName: dependencyRecord.moduleName,
				isExternal: Boolean(dependencyRecord.isExternal),
				isMissing: Boolean(dependencyRecord.isMissing),
				filePath: dependencyRecord.filePath ?? null,
				overrideApplied: Boolean(dependencyRecord.overrideApplied),
			});

			if (!moduleMap.has(dependencyRecord.id)) {
				moduleMap.set(dependencyRecord.id, dependencyRecord);
			}
		}

		dependencyGraph.set(moduleRecord.id, dependencies);
	}

	const modules = Array.from(moduleMap.values()).filter((moduleRecord) => !moduleRecord.isMissing);
	const externals = modules.filter((module) => module.isExternal === true);

	return {
		moduleMap,
		modules,
		externals,
		dependencyGraph,
	};
}
