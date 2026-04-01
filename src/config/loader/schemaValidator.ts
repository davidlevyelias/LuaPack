import fs from 'fs';
import path from 'path';
import Ajv, { ValidateFunction } from 'ajv';

import type { ConfigVersion } from './types';

const SCHEMA_V1_PATH = path.resolve(__dirname, '..', '..', '..', 'config.schema.json');
const SCHEMA_V2_PATH = path.resolve(
	__dirname,
	'..',
	'..',
	'..',
	'config.v2.schema.json'
);

type ValidatorCache = { [K in ConfigVersion]: ValidateFunction | null };

const validators: ValidatorCache = {
	v1: null,
	v2: null,
};

function createValidator(schemaPath: string): ValidateFunction {
	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
	const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
	return ajv.compile(schema);
}

export function getValidator(version: ConfigVersion): ValidateFunction {
	if (!validators[version]) {
		validators[version] = createValidator(
			version === 'v2' ? SCHEMA_V2_PATH : SCHEMA_V1_PATH
		);
	}
	return validators[version] as ValidateFunction;
}
