import type { Palette } from '../palette';
import type { ExternalSummaryEnvDetails } from '../types';

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

export function buildSummaryEnvSection(
	envVerbose: ExternalSummaryEnvDetails | null | undefined,
	palette: Palette
): string[] {
	if (!envVerbose) {
		return [];
	}

	const total = Number.isFinite(envVerbose.totalPaths)
		? envVerbose.totalPaths
		: 0;
	const header = `${palette.subBullet} ${palette.key('Env Paths:')} ${palette.muted(
		`(${total} ${total === 1 ? 'path' : 'paths'})`
	)}`;

	if (!envVerbose.entries || envVerbose.entries.length === 0) {
		return [header, `${palette.subDash} ${palette.muted('none')}`];
	}

	const lines = [header];
	envVerbose.entries.forEach((entry) => {
		const hasPaths = Array.isArray(entry.paths) && entry.paths.length > 0;
		const nameLabel = palette.envName(entry.name, hasPaths);
		if (!hasPaths) {
			lines.push(
				`${palette.subDash} ${nameLabel} ${palette.muted('(none)')}`
			);
			return;
		}
		lines.push(`${palette.subDash} ${nameLabel}`);
		entry.paths.forEach((envPath) => {
			lines.push(`${palette.subDash}   ${palette.value(envPath)}`);
		});
	});
	return lines;
}
