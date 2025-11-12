import fs from 'fs';
import type { ModuleRecord } from '../types';

type LoggerLike = {
	warn?: (...args: unknown[]) => void;
};

export function computeModuleSizeSum(modules: ModuleRecord[], logger?: LoggerLike): number {
	let total = 0;

	for (const moduleRecord of modules) {
		if (!moduleRecord?.filePath) {
			continue;
		}

		try {
			const stats = fs.statSync(moduleRecord.filePath);
			if (Number.isFinite(stats.size)) {
				total += stats.size;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger?.warn?.(
				`Failed to read size for module '${moduleRecord.moduleName}': ${message}`
			);
		}
	}

	return total;
}
