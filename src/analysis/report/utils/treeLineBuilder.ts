import type { MissingPolicy } from '../../types';
import type { Palette } from '../palette';
import { formatModuleLabel } from './labels';
import type { ModuleNode } from './dependencyTree';

export interface BuildTreeLinesOptions {
	palette: Palette;
	missingPolicy?: MissingPolicy;
}

export function buildTreeLines(
	node: ModuleNode,
	{ palette, missingPolicy }: BuildTreeLinesOptions
): string[] {
	const lines: string[] = [];

	const traverse = (
		current: ModuleNode,
		prefix = '',
		isLast = true,
		showPointer = false
	): void => {
		const pointer = showPointer ? (isLast ? '└─ ' : '├─ ') : '';
		const label = formatModuleLabel({
			palette,
			name: current.name,
			tags: current.tags || [],
			missingPolicy,
			isFolder: current.type === 'folder',
			isEntry: Boolean(current.isEntry),
			displayTags: current.displayTags !== false,
		});
		const prefixText = showPointer ? prefix : '';
		lines.push(`${prefixText}${pointer}${label}`);

		if (!current.children || current.children.length === 0) {
			return;
		}

		const nextPrefix = showPointer
			? `${prefix}${isLast ? '   ' : '│  '}`
			: '';

		current.children.forEach((child, index) => {
			const childIsLast = index === current.children.length - 1;
			traverse(child as ModuleNode, nextPrefix, childIsLast, true);
		});
	};

	traverse(node, '', true, false);
	return lines;
}
