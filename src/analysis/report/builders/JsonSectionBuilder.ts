import type {
	MissingModuleRecord,
	ModuleDependencyEdge,
	ModuleRecord,
} from '../../types';
import type { ReporterAnalysis } from '../types';
import type {
	JsonDependencyGraphItem,
	JsonExternalSectionItem,
	JsonIgnoredModuleSectionItem,
	JsonModuleSectionItem,
	JsonSections,
} from '../jsonTypes';
import { normalizePathSlashes } from '../utils/format';

export function buildJsonSections(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): JsonSections {
	return {
		externals: buildJsonExternalSectionItems(analysis, { includeMissing }),
		ignoredModules: buildIgnoredModuleSectionItems(analysis),
		modulesByPackage: buildModulesByPackage(analysis.modules),
		dependencyGraph: buildDependencyGraphSnapshot(analysis, {
			includeMissing,
		}),
	};
}

export function buildJsonExternalSectionItems(
	analysis: ReporterAnalysis,
	{ includeMissing: _includeMissing = true }: { includeMissing?: boolean } = {}
): JsonExternalSectionItem[] {
	return buildExternalSectionItems(analysis.externals);
}

function toModuleSectionItem(
	moduleRecord: ModuleRecord
): JsonModuleSectionItem {
	return {
		id: moduleRecord.id,
		name: moduleRecord.moduleName,
		localModuleId: moduleRecord.localModuleId || moduleRecord.moduleName,
		filePath: normalizeSerializablePath(moduleRecord.filePath),
	};
}

function buildModulesByPackage(
	modules: ModuleRecord[] | null | undefined
): Record<string, JsonModuleSectionItem[]> {
	const grouped: Record<string, JsonModuleSectionItem[]> = {};
	for (const moduleRecord of modules || []) {
		if (moduleRecord.isExternal) {
			continue;
		}
		const packageName = moduleRecord.packageName || 'default';
		if (!grouped[packageName]) {
			grouped[packageName] = [];
		}
		grouped[packageName].push(toModuleSectionItem(moduleRecord));
	}

	const sortedEntries = Object.entries(grouped)
		.sort(([leftPackage], [rightPackage]) =>
			leftPackage.localeCompare(rightPackage)
		)
		.map(([packageName, packageModules]) => [
			packageName,
			packageModules.sort((left, right) => left.id.localeCompare(right.id)),
		]);

	return Object.fromEntries(sortedEntries);
}

function buildExternalSectionItems(
	externals: ModuleRecord[] | null | undefined
): JsonExternalSectionItem[] {
	const items = new Map<string, JsonExternalSectionItem>();

	for (const moduleRecord of externals || []) {
		const id = moduleRecord.id || moduleRecord.moduleName;
		items.set(id, {
			id,
			name: moduleRecord.moduleName,
			packageName: moduleRecord.packageName || 'default',
			localModuleId: moduleRecord.localModuleId || moduleRecord.moduleName,
			status: 'runtime',
		});
	}

	return Array.from(items.values()).sort((left, right) =>
		left.id.localeCompare(right.id)
	);
}

function buildIgnoredModuleSectionItems(
	analysis: ReporterAnalysis
): JsonIgnoredModuleSectionItem[] {
	const items = new Map<string, JsonIgnoredModuleSectionItem>();

	for (const dependencies of analysis.dependencyGraph.values()) {
		for (const dependency of dependencies || []) {
			if (!dependency.isIgnored) {
				continue;
			}
			const id = dependency.id || dependency.moduleName;
			items.set(id, {
				id,
				name: dependency.moduleName,
				packageName: dependency.packageName || 'default',
				localModuleId: dependency.localModuleId || dependency.moduleName,
			});
		}
	}

	return Array.from(items.values()).sort((left, right) =>
		left.id.localeCompare(right.id)
	);
}

function buildDependencyGraphSnapshot(
	analysis: ReporterAnalysis,
	{ includeMissing = true }: { includeMissing?: boolean } = {}
): Record<string, JsonDependencyGraphItem[]> {
	const sortedEntries = Array.from(analysis.dependencyGraph.entries())
		.sort(([leftModuleId], [rightModuleId]) =>
			leftModuleId.localeCompare(rightModuleId)
		)
		.map(([moduleId, dependencies]) => [
			moduleId,
			dependencies
			.filter(
				(dependency: ModuleDependencyEdge) =>
					includeMissing || (!dependency.isMissing && !dependency.isIgnored)
			)
			.map((dependency: ModuleDependencyEdge) => ({
				id: dependency.id,
				name: dependency.moduleName,
				packageName: dependency.packageName,
				localModuleId: dependency.localModuleId,
				type: dependency.isExternal ? 'external' : 'module',
				status: dependency.isIgnored
					? 'ignored'
					: dependency.isMissing
						? 'missing'
						: dependency.isExternal && !dependency.filePath
							? 'runtime'
							: 'resolved',
				filePath: normalizeSerializablePath(dependency.filePath),
				ruleApplied: dependency.ruleApplied,
				}))
				.sort((left, right) => left.id.localeCompare(right.id)),
			]);

		return Object.fromEntries(sortedEntries);
}

function normalizeSerializablePath(
	targetPath: string | null | undefined
): string | null {
	if (!targetPath) {
		return null;
	}
	return normalizePathSlashes(targetPath);
}
