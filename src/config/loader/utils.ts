import path from 'path';

import type { ErrorObject } from 'ajv';

export function buildDefaultOutputPath(entryPath: string): string {
	const entryDir = path.dirname(entryPath);
	const entryExt = path.extname(entryPath);
	const entryBase =
		path.basename(entryPath, entryExt) || path.basename(entryPath);
	const outputName = `${entryBase}_packed.lua`;
	return path.join(entryDir, outputName);
}

export function hasOwn(target: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(target, key);
}

export function formatErrors(errors: ErrorObject[]): string {
	return errors
		.map((err) => {
			const dataPath =
				err.instancePath ||
				(err as unknown as { dataPath?: string }).dataPath ||
				'';
			const location = dataPath
				? `property '${dataPath.replace(/^\./, '')}'`
				: 'configuration root';
			return `- ${location}: ${err.message}`;
		})
		.join('\n');
}
