import path from 'path';

import type { MissingModuleRecord, ModuleRecord } from '../../types';
import type { DependencyTreeNode } from '../sections/DependencyTreeSection';
import type { ReporterAnalysis } from '../types';
import { collectModuleTags } from './labels';

export interface ModuleNode extends DependencyTreeNode {
	children: ModuleNode[];
}

interface ModuleInsertOptions {
	tags?: string[];
	isEntry?: boolean;
}

interface ResolvePathOptions {
	filePath: string;
	rootDir: string | null;
	externalSections: Map<string, ModuleNode>;
	externalPaths: Array<{ path: string; key: string }>;
	sections: ModuleNode[];
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

interface ResolveMissingOptions {
	missing: MissingModuleRecord;
	rootDir: string | null;
	sections: ModuleNode[];
	externalSections: Map<string, ModuleNode>;
	externalPaths: Array<{ path: string; key: string }>;
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

export interface BuildDependencyTreeSectionsOptions {
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

export function buildDependencyTreeSections(
	analysis: ReporterAnalysis,
	{ formatPath, isWithinRoot }: BuildDependencyTreeSectionsOptions
): ModuleNode[] {
	const sections: ModuleNode[] = [];
	const context = analysis.context || {};
	const rootSection = createFolderNode('[Root Dir]/');
	sections.push(rootSection);
	const externalSections = new Map<string, ModuleNode>();
	const normalizedRootDir = context.rootDir ? path.resolve(context.rootDir) : null;
	const baseForExternals = normalizedRootDir || process.cwd();
	const externalPaths = (context.externals?.paths || []).map((externalPath) => {
		const absolutePath = path.resolve(baseForExternals, externalPath);
		return {
			path: absolutePath,
			key: `${formatPath(absolutePath)}/`,
		};
	});

	const entryFilePath = analysis.entryModule?.filePath ?? null;
	const rootDir = normalizedRootDir;

	const addModuleRecord = (moduleRecord: ModuleRecord | null | undefined): void => {
		if (!moduleRecord || !moduleRecord.filePath) {
			return;
		}
		const isEntry = Boolean(entryFilePath && moduleRecord.filePath === entryFilePath);
		const base = resolveSectionForPath({
			filePath: moduleRecord.filePath,
			rootDir,
			externalSections,
			externalPaths,
			sections,
			formatPath,
			isWithinRoot,
		});
		const { relativeParts, section } = base;

		const tags = collectModuleTags(moduleRecord);
		insertPath(section, relativeParts, {
			tags,
			isEntry,
		});
	};

	(analysis.sortedModules || []).forEach(addModuleRecord);

	const missingSeen = new Set<string>();
	for (const missing of analysis.missing) {
		const key = missing.moduleName || missing.requireId;
		if (missingSeen.has(key)) {
			continue;
		}
		missingSeen.add(key);

		const target = resolveMissingSection({
			missing,
			rootDir,
			sections,
			externalSections,
			externalPaths,
			formatPath,
			isWithinRoot,
		});
		const { relativeParts: parts, section } = target;
		const tags = ['missing'];
		if (missing.isExternal) {
			tags.push('external');
		}
		if (missing.overrideApplied) {
			tags.push('override');
		}
		insertPath(section, parts, {
			tags,
			isEntry: false,
		});
	}

	return sections.filter((section) => section.children.length > 0);
}

function resolveSectionForPath({
	filePath,
	rootDir,
	externalSections,
	externalPaths,
	sections,
	formatPath,
	isWithinRoot,
}: ResolvePathOptions): { section: ModuleNode; relativeParts: string[] } {
	if (rootDir && isWithinRoot(filePath, rootDir)) {
		const relative = path.relative(rootDir, filePath);
		return {
			section: sections[0],
			relativeParts: relative ? splitPath(relative, true) : [path.basename(filePath)],
		};
	}

	const match = externalPaths.find((candidate) => isWithinRoot(filePath, candidate.path));
	if (match) {
		let section = externalSections.get(match.key);
		if (!section) {
			section = createFolderNode(match.key);
			externalSections.set(match.key, section);
			sections.push(section);
		}
		const relative = path.relative(match.path, filePath);
		return {
			section,
			relativeParts: relative ? splitPath(relative, true) : [path.basename(filePath)],
		};
	}

	const fallbackLabel = `${formatPath(path.dirname(filePath))}/`;
	let fallbackSection = externalSections.get(fallbackLabel);
	if (!fallbackSection) {
		fallbackSection = createFolderNode(fallbackLabel);
		externalSections.set(fallbackLabel, fallbackSection);
		sections.push(fallbackSection);
	}
	return {
		section: fallbackSection,
		relativeParts: [path.basename(filePath)],
	};
}

function resolveMissingSection({
	missing,
	rootDir,
	sections,
	externalSections,
	externalPaths,
	formatPath,
	isWithinRoot,
}: ResolveMissingOptions): { section: ModuleNode; relativeParts: string[] } {
	if (missing.filePath) {
		return resolveSectionForPath({
			filePath: missing.filePath,
			rootDir,
			externalSections,
			externalPaths,
			sections,
			formatPath,
			isWithinRoot,
		});
	}
	const name = (missing.moduleName || missing.requireId || 'unknown').replace(/\\/g, '/');
	const parts = name.split(/[/.]/).filter(Boolean);
	if (parts.length === 0) {
		parts.push(name);
	}
	return {
		section: sections[0],
		relativeParts: decorateMissingParts(parts),
	};
}

function insertPath(
	section: ModuleNode,
	parts: string[],
	{ tags = [], isEntry = false }: ModuleInsertOptions = {}
): void {
	let cursor: ModuleNode = section;
	for (let index = 0; index < parts.length; index += 1) {
		const segment = parts[index];
		const isLast = index === parts.length - 1;
		if (isLast) {
			const existing = cursor.children.find(
				(child) => child.name === segment && child.type === 'module'
			) as ModuleNode | undefined;
			if (existing) {
				existing.tags = Array.from(new Set([...(existing.tags || []), ...tags]));
				existing.isEntry = Boolean(existing.isEntry || isEntry);
			} else {
				cursor.children.push({
					name: segment,
					type: 'module',
					tags: [...tags],
					isEntry,
					children: [],
				});
			}
		} else {
			const folderName = segment.endsWith('/') ? segment : `${segment}/`;
			let childFolder = cursor.children.find(
				(child) => child.name === folderName && child.type === 'folder'
			) as ModuleNode | undefined;
			if (!childFolder) {
				childFolder = createFolderNode(folderName);
				cursor.children.push(childFolder);
			}
			cursor = childFolder;
		}
	}
}

function createFolderNode(name: string): ModuleNode {
	return {
		name,
		type: 'folder',
		children: [],
		tags: [],
		displayTags: false,
	};
}

function splitPath(relativePath: string, appendExtension: boolean): string[] {
	const segments = relativePath.split(path.sep).filter(Boolean);
	if (segments.length === 0) {
		return [relativePath];
	}
	return segments.map((segment, index) => {
		if (index === segments.length - 1) {
			const finalSegment = appendExtension ? segment : segment.replace(/\\/g, '/');
			return finalSegment;
		}
		return `${segment}/`;
	});
}

function decorateMissingParts(parts: string[]): string[] {
	if (parts.length === 0) {
		return parts;
	}
	const cloned = [...parts];
	for (let index = 0; index < cloned.length - 1; index += 1) {
		cloned[index] = `${cloned[index]}/`;
	}
	return cloned;
}
