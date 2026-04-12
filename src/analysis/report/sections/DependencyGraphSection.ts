import type { ModuleDependencyEdge, ModuleRecord } from '../../types';
import type { Palette } from '../palette';
import type { ReporterAnalysis } from '../types';

export interface DependencyGraphNode {
	id: string;
	tags: string[];
	refId?: number;
	isReference?: boolean;
	children: DependencyGraphNode[];
}

export interface DependencyGraphPackageSection {
	packageName: string;
	roots: DependencyGraphNode[];
}

function getModulePackageName(moduleId: string, moduleRecord?: ModuleRecord | null): string {
	if (moduleRecord?.packageName) {
		return moduleRecord.packageName;
	}

	if (moduleId.startsWith('@') && moduleId.includes('/')) {
		return moduleId.slice(1, moduleId.indexOf('/')) || 'default';
	}

	return 'default';
}

function getCanonicalModuleId(moduleId: string, moduleRecord?: ModuleRecord | null): string {
	if (moduleRecord?.canonicalModuleId) {
		return moduleRecord.canonicalModuleId;
	}
	return moduleId;
}

function collectNodeTags(dependency: ModuleDependencyEdge): string[] {
	const tags: string[] = [];
	if (dependency.isExternal) {
		tags.push('external');
	}
	if (dependency.isIgnored) {
		tags.push('ignored');
	}
	if (dependency.isMissing) {
		tags.push('missing');
	}
	return tags;
}

function getPreferredRootId(
	packageName: string,
	packageSourceIds: string[],
	moduleLookup: Map<string, ModuleRecord>,
	analysis: ReporterAnalysis
): string | null {
	const sortedIds = packageSourceIds
		.slice()
		.sort((left, right) =>
			getCanonicalModuleId(left, moduleLookup.get(left)).localeCompare(
				getCanonicalModuleId(right, moduleLookup.get(right))
			)
		);

	const entryModule = analysis.entryModule;
	if (
		entryModule &&
		(entryModule.packageName || 'default') === packageName &&
		packageSourceIds.includes(entryModule.id)
	) {
		return entryModule.id;
	}

	const initCandidate = sortedIds.find((moduleId) => {
		const moduleRecord = moduleLookup.get(moduleId);
		return moduleRecord?.localModuleId === 'init';
	});
	if (initCandidate) {
		return initCandidate;
	}

	return sortedIds[0] || null;
}

function createModuleLookup(analysis: ReporterAnalysis): Map<string, ModuleRecord> {
	const lookup = new Map<string, ModuleRecord>();
	const records = [analysis.entryModule, ...(analysis.modules || []), ...(analysis.externals || [])]
		.filter((record): record is ModuleRecord => Boolean(record));

	for (const record of records) {
		if (record.id) {
			lookup.set(record.id, record);
		}
		if (record.canonicalModuleId) {
			lookup.set(record.canonicalModuleId, record);
		}
	}

	for (const [moduleId] of analysis.dependencyGraph.entries()) {
		const directMatch = analysis.moduleById.get(moduleId);
		if (directMatch) {
			lookup.set(moduleId, directMatch);
			if (directMatch.canonicalModuleId) {
				lookup.set(directMatch.canonicalModuleId, directMatch);
			}
		}
	}

	return lookup;
}

export function buildDependencyGraphSections(
	analysis: ReporterAnalysis
): DependencyGraphPackageSection[] {
	const moduleLookup = createModuleLookup(analysis);
	const packageToRoots = new Map<string, string[]>();
	const packageToIncoming = new Map<string, Set<string>>();
	const sourceIds = Array.from(analysis.dependencyGraph.keys()).sort((left, right) =>
		getCanonicalModuleId(left, moduleLookup.get(left)).localeCompare(
			getCanonicalModuleId(right, moduleLookup.get(right))
		)
	);

	for (const sourceId of sourceIds) {
		const sourceRecord = moduleLookup.get(sourceId);
		const packageName = getModulePackageName(sourceId, sourceRecord);
		if (!packageToRoots.has(packageName)) {
			packageToRoots.set(packageName, []);
		}
		packageToRoots.get(packageName)?.push(sourceId);
		if (!packageToIncoming.has(packageName)) {
			packageToIncoming.set(packageName, new Set<string>());
		}

		for (const dependency of analysis.dependencyGraph.get(sourceId) || []) {
			const dependencyRecord = moduleLookup.get(dependency.id);
			if (
				!analysis.dependencyGraph.has(dependency.id) ||
				getModulePackageName(dependency.id, dependencyRecord) !== packageName
			) {
				continue;
			}
			packageToIncoming.get(packageName)?.add(dependency.id);
		}
	}

	return Array.from(packageToRoots.entries())
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([packageName, packageSourceIds]) => {
			const referenceIds = new Map<string, number>();
			let nextReferenceId = 1;
			const getReferenceId = (moduleId: string): number => {
				let refId = referenceIds.get(moduleId);
				if (!refId) {
					refId = nextReferenceId;
					referenceIds.set(moduleId, refId);
					nextReferenceId += 1;
				}
				return refId;
			};
			const incoming = packageToIncoming.get(packageName) || new Set<string>();
			const rootIds = packageSourceIds.filter((moduleId) => !incoming.has(moduleId));
			const fallbackRootId = getPreferredRootId(
				packageName,
				packageSourceIds,
				moduleLookup,
				analysis
			);
			const effectiveRootIds = (rootIds.length > 0
				? rootIds
				: fallbackRootId
					? [fallbackRootId]
					: packageSourceIds
			)
				.slice()
				.sort((left, right) =>
					getCanonicalModuleId(left, moduleLookup.get(left)).localeCompare(
						getCanonicalModuleId(right, moduleLookup.get(right))
					)
				);
			const expandedWithinPackage = new Set<string>();
			const annotateReferenceDefinitions = (
				node: DependencyGraphNode
			): void => {
				if (!node.isReference && referenceIds.has(node.id)) {
					node.refId = referenceIds.get(node.id);
				}
				node.children.forEach(annotateReferenceDefinitions);
			};

			const buildNode = (
				moduleId: string,
				packageName: string,
				ancestors: Set<string>,
				expandedWithinPackage: Set<string>,
				{ forceExpand = false }: { forceExpand?: boolean } = {}
			): DependencyGraphNode => {
				const moduleRecord = moduleLookup.get(moduleId);
				const canonicalId = getCanonicalModuleId(moduleId, moduleRecord);
				const node: DependencyGraphNode = {
					id: canonicalId,
					tags: [],
					children: [],
				};

				if (!forceExpand && expandedWithinPackage.has(canonicalId)) {
					node.tags.push('ref');
					node.refId = getReferenceId(canonicalId);
					node.isReference = true;
					return node;
				}

				expandedWithinPackage.add(canonicalId);
				const nextAncestors = new Set(ancestors);
				nextAncestors.add(moduleId);
				nextAncestors.add(canonicalId);
				const dependencies = (analysis.dependencyGraph.get(moduleId) || [])
					.slice()
					.sort((left, right) => left.id.localeCompare(right.id));

				node.children = dependencies.map((dependency) => {
					const dependencyRecord = moduleLookup.get(dependency.id);
					const dependencyPackageName = getModulePackageName(
						dependency.id,
						dependencyRecord
					);
					const dependencyCanonicalId = getCanonicalModuleId(
						dependency.id,
						dependencyRecord
					);
					const child: DependencyGraphNode = {
						id: dependencyCanonicalId,
						tags: collectNodeTags(dependency),
						children: [],
					};
					const isRecursiveDisabled =
						dependencyRecord?.analyzeDependencies === false &&
						!dependency.isExternal &&
						!dependency.isMissing &&
						!dependency.isIgnored;

					if (isRecursiveDisabled) {
						child.tags.push('non-recursive');
					}

					if (
						dependencyPackageName === packageName &&
						analysis.dependencyGraph.has(dependency.id)
					) {
						if (
							nextAncestors.has(dependency.id) ||
							nextAncestors.has(dependencyCanonicalId)
						) {
							child.tags.push('circular');
							return child;
						}

						if (!isRecursiveDisabled) {
							const expandedChild = buildNode(
								dependency.id,
								packageName,
								nextAncestors,
								expandedWithinPackage
							);
							child.tags = Array.from(
								new Set([...expandedChild.tags, ...child.tags])
							);
							child.children = expandedChild.children;
							child.refId = expandedChild.refId;
							child.isReference = expandedChild.isReference;
						}
					}

					return child;
				});

				return node;
			};
			const roots = effectiveRootIds.map((moduleId) =>
				buildNode(
					moduleId,
					packageName,
					new Set<string>(),
					expandedWithinPackage,
					{ forceExpand: true }
				)
			);
			roots.forEach(annotateReferenceDefinitions);

			return {
				packageName,
				roots,
			};
		})
		.filter((section) => section.roots.length > 0);
}

function renderGraphNode(
	node: DependencyGraphNode,
	palette: Palette,
	missingPolicy: 'error' | 'warn',
	lines: string[],
	prefix = '',
	isLast = true,
	showPointer = false
): void {
	const pointer = showPointer ? (isLast ? '└─ ' : '├─ ') : '';
	const label = formatGraphNodeLabel(node, palette, missingPolicy);
	const prefixText = showPointer ? prefix : '';
	lines.push(`${prefixText}${pointer}${label}`);

	const nextPrefix = showPointer ? `${prefix}${isLast ? '   ' : '│  '}` : '';
	node.children.forEach((child, index) => {
		renderGraphNode(
			child,
			palette,
			missingPolicy,
			lines,
			nextPrefix,
			index === node.children.length - 1,
			true
		);
	});
}

export function buildDependencyGraphSection(
	sections: DependencyGraphPackageSection[] | null | undefined,
	palette: Palette,
	missingPolicy: 'error' | 'warn'
): string[] {
	if (!sections || sections.length === 0) {
		return [];
	}

	const lines: string[] = [];
	lines.push(palette.heading('Dependency Graph'));
	lines.push(palette.divider);

	sections.forEach((section, sectionIndex) => {
		if (sectionIndex > 0) {
			lines.push('');
		}
		lines.push(formatPackageHeader(section.packageName, palette));
		section.roots.forEach((root, rootIndex) => {
			if (rootIndex > 0) {
				lines.push('');
			}
			renderGraphNode(root, palette, missingPolicy, lines);
		});
	});

	return lines;
}

function formatPackageHeader(packageName: string, palette: Palette): string {
	return `${palette.value('[')}${palette.packageToken(
		packageName,
		packageName
	)}${palette.value(']')}`;
}

function formatCanonicalModuleId(moduleId: string, palette: Palette): string {
	if (!moduleId.startsWith('@') || !moduleId.includes('/')) {
		return palette.value(moduleId);
	}

	const slashIndex = moduleId.indexOf('/');
	const packageName = moduleId.slice(1, slashIndex);
	const suffix = moduleId.slice(slashIndex);
	return `${palette.value('@')}${palette.packageToken(
		packageName,
		packageName
	)}${palette.value(suffix)}`;
}

function formatGraphTags(
	node: DependencyGraphNode,
	palette: Palette,
	missingPolicy: 'error' | 'warn'
): string {
	const tags = [...node.tags].filter((tag) => tag !== 'ref');
	if (tags.length === 0) {
		return '';
	}

	const renderedTags = tags.map((tag) =>
		palette.graphTag(tag, tag, { missingPolicy })
	);
	return ` ${palette.value('(')}${renderedTags.join(
		palette.value(', ')
	)}${palette.value(')')}`;
}

function formatReferenceDefinition(
	node: DependencyGraphNode,
	palette: Palette
): string {
	if (node.isReference || !node.refId) {
		return '';
	}
	return ` ${palette.graphRefDefinition(`[#${node.refId}]`)}`;
}

function formatReferencePointer(
	node: DependencyGraphNode,
	palette: Palette
): string {
	if (!node.isReference || !node.refId) {
		return '';
	}
	return ` ${palette.graphRefPointer(`-> #${node.refId}`)}`;
}

function formatGraphNodeLabel(
	node: DependencyGraphNode,
	palette: Palette,
	missingPolicy: 'error' | 'warn'
): string {
	return `${formatCanonicalModuleId(node.id, palette)}${formatReferenceDefinition(
		node,
		palette
	)}${formatReferencePointer(
		node,
		palette
	)}${formatGraphTags(
		node,
		palette,
		missingPolicy
	)}`;
}