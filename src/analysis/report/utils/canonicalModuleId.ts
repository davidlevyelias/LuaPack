import type { Palette } from '../palette';

export function formatCanonicalModuleId(
	moduleId: string,
	palette: Palette
): string {
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
