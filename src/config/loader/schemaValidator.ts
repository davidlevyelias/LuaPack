import fs from 'fs';
import path from 'path';
import Ajv, { ValidateFunction } from 'ajv';

import type { ConfigVersion } from './types';

const SCHEMA_PATH = path.resolve(__dirname, '..', '..', '..', 'config.schema.json');

let validator: ValidateFunction | null = null;

function createValidator(schemaPath: string): ValidateFunction {
	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
	const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
	return ajv.compile(schema);
}

export function getValidator(version: ConfigVersion): ValidateFunction {
	void version;
	if (!validator) {
		validator = createValidator(SCHEMA_PATH);
	}
	return validator;
}
