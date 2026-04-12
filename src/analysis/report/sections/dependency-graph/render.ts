import type { Palette } from '../../palette';
import { formatGraphNodeLabel, formatPackageHeader } from './format';
import type {
	DependencyGraphNode,
	DependencyGraphPackageSection,
} from './types';

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
