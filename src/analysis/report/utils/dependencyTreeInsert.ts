import type { DependencyTreeNode } from '../sections/DependencyTreeSection';

export interface ModuleNode extends DependencyTreeNode {
	children: ModuleNode[];
}

interface ModuleInsertOptions {
	tags?: string[];
	isEntry?: boolean;
}

export function insertModulePath(
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
				existing.tags = Array.from(
					new Set([...(existing.tags || []), ...tags])
				);
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

export function createFolderNode(name: string): ModuleNode {
	return {
		name,
		type: 'folder',
		children: [],
		tags: [],
		displayTags: false,
	};
}

export function decorateMissingParts(parts: string[]): string[] {
	if (parts.length === 0) {
		return parts;
	}
	const cloned = [...parts];
	for (let index = 0; index < cloned.length - 1; index += 1) {
		cloned[index] = `${cloned[index]}/`;
	}
	return cloned;
}
