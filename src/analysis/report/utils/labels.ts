import type { ModuleRecord } from '../../types';
import type { Palette } from '../palette';

export interface FormatModuleLabelOptions {
	palette: Palette;
	name: string;
	tags?: string[];
	ignoreMissing?: boolean;
	isFolder?: boolean;
	isEntry?: boolean;
	displayTags?: boolean;
}

export type TaggedModuleRecord = Partial<ModuleRecord> & {
	analyzeDependencies?: boolean;
};

export function collectModuleTags(
	moduleRecord: TaggedModuleRecord | null | undefined
): string[] {
	const tags: string[] = [];
	if (!moduleRecord) {
		return tags;
	}
	if (moduleRecord.isExternal) {
		tags.push('external');
	}
	if (moduleRecord.overrideApplied) {
		tags.push('override');
	}
	if (moduleRecord.analyzeDependencies === false && !moduleRecord.isExternal) {
		tags.push('skipped');
	}
	return tags;
}

export function formatModuleLabel({
	palette,
	name,
	tags = [],
	ignoreMissing = false,
	isFolder = false,
	isEntry = false,
	displayTags = true,
}: FormatModuleLabelOptions): string {
	const suffix = displayTags && tags.length > 0 ? ` (${tags.join(', ')})` : '';
	const label = `${name}${suffix}`;

	if (isEntry) {
		return palette.entry(label);
	}

	if (isFolder) {
		return palette.folder(label);
	}

	if (tags.includes('skipped')) {
		return palette.muted(label);
	}

	const hasMissing = tags.includes('missing');
	const hasExternal = tags.includes('external');

	if (hasMissing && hasExternal) {
		return ignoreMissing ? palette.muted(label) : palette.error(label);
	}

	if (hasMissing) {
		return ignoreMissing ? palette.muted(label) : palette.error(label);
	}

	if (hasExternal) {
		return palette.external(label);
	}

	if (tags.includes('override')) {
		return palette.override(label);
	}

	return palette.module(label);
}
