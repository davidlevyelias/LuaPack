import type { ValidateFunction } from 'ajv';

import { formatErrors } from './utils';

export function validateConfig(validatorInstance: ValidateFunction, config: unknown): void {
	const valid = validatorInstance(config);
	if (!valid) {
		const details = formatErrors(validatorInstance.errors || []);
		throw new Error(`Invalid configuration:\n${details}`);
	}

	const typedConfig = config as { entry?: unknown };
	if (!typedConfig.entry) {
		throw new Error('Configuration must specify an entry file.');
	}
}
