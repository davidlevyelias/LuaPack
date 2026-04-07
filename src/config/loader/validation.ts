import type { ValidateFunction } from 'ajv';

import { formatErrors } from './utils';

export function validateConfig(
	validatorInstance: ValidateFunction,
	config: unknown
): void {
	const valid = validatorInstance(config);
	if (!valid) {
		const details = formatErrors(validatorInstance.errors || []);
		throw Object.assign(new Error(`Invalid configuration:\n${details}`), {
			code: 'CONFIG_INVALID',
			errorType: 'config',
		});
	}

	const typedConfig = config as { entry?: unknown };
	if (!typedConfig.entry) {
		throw Object.assign(
			new Error('Configuration must specify an entry file.'),
			{
				code: 'ENTRY_REQUIRED',
				errorType: 'config',
			}
		);
	}
}
