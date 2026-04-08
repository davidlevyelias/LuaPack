import type { Palette } from '../palette';

export function buildSummaryListSection<T>(
	headerLine: string,
	items: T[] | undefined,
	palette: Palette,
	formatItem: (item: T) => string = (item) => palette.value(String(item))
): string[] {
	if (!items || items.length === 0) {
		return [headerLine, `${palette.subDash} ${palette.muted('none')}`];
	}
	const result = [headerLine];
	items.forEach((item) => {
		result.push(`${palette.subDash} ${formatItem(item)}`);
	});
	return result;
}
