import path from 'path';

import type { ModuleRecord } from '../../types';
import { normalizePathSlashes } from './format';

export function formatReportPath(
	targetPath: string | null | undefined,
	{ cwd = process.cwd() }: { cwd?: string } = {}
): string {
	if (!targetPath) {
		return 'N/A';
	}
	if (!path.isAbsolute(targetPath)) {
		return normalizePathSlashes(targetPath);
	}
	const relative = path.relative(cwd, targetPath);
	if (!relative || relative === '') {
		return '.';
	}
	return relative.startsWith('..')
		? normalizePathSlashes(targetPath)
		: normalizePathSlashes(relative);
}

export function isWithinReportRoot(
	targetPath: string,
	rootDir: string
): boolean {
	if (!targetPath || !rootDir) {
		return false;
	}
	const relative = path.relative(rootDir, targetPath);
	if (relative === '') {
		return true;
	}
	return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function getModuleDisplayName(
	moduleRecord: ModuleRecord,
	rootDir: string | null,
	{ cwd = process.cwd() }: { cwd?: string } = {}
): string {
	if (!moduleRecord.filePath) {
		return moduleRecord.moduleName;
	}
	if (rootDir && isWithinReportRoot(moduleRecord.filePath, rootDir)) {
		const relative = path.relative(rootDir, moduleRecord.filePath);
		return normalizePathSlashes(relative);
	}
	return formatReportPath(moduleRecord.filePath, { cwd });
}
