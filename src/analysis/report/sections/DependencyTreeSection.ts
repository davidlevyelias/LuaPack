import type { Palette } from '../palette';

export interface DependencyTreeNode {
	name: string;
	type: 'folder' | 'module';
	tags?: string[];
	isEntry?: boolean;
	displayTags?: boolean;
	children: DependencyTreeNode[];
}

export interface DependencyTreeSectionOptions<TSection> {
	palette: Palette;
	renderSection: (section: TSection, index: number) => string[];
}

export function buildDependencyTreeSection<TSection>(
	sections: TSection[] | null | undefined,
	{ palette, renderSection }: DependencyTreeSectionOptions<TSection>
): string[] {
	if (!sections || sections.length === 0) {
		return [];
	}
	const lines: string[] = [palette.heading('Dependency Tree'), palette.divider];
	sections.forEach((section, index) => {
		const rendered = renderSection(section, index);
		rendered.forEach((line) => {
			lines.push(line);
		});
		if (index < sections.length - 1) {
			lines.push('');
		}
	});
	return lines;
}
