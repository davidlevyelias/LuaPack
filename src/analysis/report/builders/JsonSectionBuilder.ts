import type {
	MissingModuleRecord,
	ModuleDependencyEdge,
	ModuleRecord,
} from '../../types';
import type { ReporterAnalysis } from '../types';
import type {
	JsonDependencyGraphItem,
	JsonExternalSectionItem,
	JsonModuleSectionItem,
	JsonSections,
	JsonTopologicalItem,
} from '../jsonTypes';
import { normalizePathSlashes } from '../utils/format';

export function buildJsonSections(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): JsonSections {
	return {
		modules: analysis.modules.map(toModuleSectionItem),
		externals: buildJsonExternalSectionItems(analysis, { includeMissing }),
		dependencyGraph: buildDependencyGraphSnapshot(analysis, {
			includeMissing,
		}),
		topologicalOrder: analysis.sortedModules.map(toTopologicalItem),
	};
}

export function buildJsonExternalSectionItems(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): JsonExternalSectionItem[] {
	return buildExternalSectionItems(
		analysis.externals,
		analysis.missing || [],
		{
			includeMissing,
		}
	);
}

function toModuleSectionItem(
	moduleRecord: ModuleRecord
): JsonModuleSectionItem {
	return {
		id: moduleRecord.id,
		name: moduleRecord.moduleName,
		filePath: normalizeSerializablePath(moduleRecord.filePath),
	};
}

function toTopologicalItem(moduleRecord: ModuleRecord): JsonTopologicalItem {
	return {
		name: moduleRecord.moduleName,
		filePath: normalizeSerializablePath(moduleRecord.filePath),
		type: moduleRecord.isExternal ? 'external' : 'module',
	};
}

function buildExternalSectionItems(
	externals: ModuleRecord[] | null | undefined,
	missing: MissingModuleRecord[],
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): JsonExternalSectionItem[] {
	const items = new Map<string, JsonExternalSectionItem>();

	for (const moduleRecord of externals || []) {
		const id = moduleRecord.id || moduleRecord.moduleName;
		items.set(id, {
			id,
			name: moduleRecord.moduleName,
			filePath: normalizeSerializablePath(moduleRecord.filePath),
			status: 'resolved',
			ruleApplied: Boolean(moduleRecord.overrideApplied),
		});
	}

	for (const missingRecord of missing) {
		if (!includeMissing || !missingRecord.isExternal) {
			continue;
		}
		const id = missingRecord.requireId || missingRecord.moduleName;
		if (items.has(id)) {
			continue;
		}
		items.set(id, {
			id,
			name: missingRecord.moduleName,
			filePath: normalizeSerializablePath(missingRecord.filePath),
			status: 'missing',
			ruleApplied: Boolean(missingRecord.overrideApplied),
		});
	}

	return Array.from(items.values());
}

function buildDependencyGraphSnapshot(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): Record<string, JsonDependencyGraphItem[]> {
	const snapshot: Record<string, JsonDependencyGraphItem[]> = {};
	for (const [moduleId, dependencies] of analysis.dependencyGraph.entries()) {
		snapshot[moduleId] = dependencies
			.filter(
				(dependency: ModuleDependencyEdge) =>
					includeMissing || !dependency.isMissing
			)
			.map((dependency: ModuleDependencyEdge) => ({
				id: dependency.id,
				name: dependency.moduleName,
				type: dependency.isExternal ? 'external' : 'module',
				status: dependency.isMissing ? 'missing' : 'resolved',
				filePath: normalizeSerializablePath(dependency.filePath),
				ruleApplied: dependency.overrideApplied,
			}));
	}
	return snapshot;
}

function normalizeSerializablePath(
	targetPath: string | null | undefined
): string | null {
	if (!targetPath) {
		return null;
	}
	return normalizePathSlashes(targetPath);
}
