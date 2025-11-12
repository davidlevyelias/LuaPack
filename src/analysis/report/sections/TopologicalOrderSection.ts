import type { Palette } from '../palette';

export interface TopologicalItem {
	name: string;
	tags: string[];
	isEntry?: boolean;
}

export interface TopologicalOrderSectionOptions<TItem> {
	palette: Palette;
	formatItem: (item: TItem, index: number) => string;
}

export function buildTopologicalOrderSection<TItem>(
	items: TItem[] | null | undefined,
	{ palette, formatItem }: TopologicalOrderSectionOptions<TItem>
): string[] {
	if (!items || items.length === 0) {
		return [];
	}
	const lines: string[] = [palette.heading('Topological Order'), palette.divider];
	items.forEach((item, index) => {
		const indexLabel = palette.muted(String(index + 1).padStart(2, '0'));
		lines.push(`${indexLabel}. ${formatItem(item, index)}`);
	});
	return lines;
}
