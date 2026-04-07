import type { ModuleRecord } from './types';

export type LoggerLike = {
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
	debug?: (...args: unknown[]) => void;
};

export function isModuleRecord(value: unknown): value is ModuleRecord {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const record = value as Record<string, unknown>;
	return (
		typeof record.id === 'string' && typeof record.moduleName === 'string'
	);
}
