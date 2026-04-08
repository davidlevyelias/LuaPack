import type { ValidateFunction } from 'ajv';

import { formatErrors } from './utils';

interface RawPackageValidationShape {
	dependencies?: Record<string, unknown>;
	rules?: Record<string, unknown>;
}

function getDeclaredPackageNames(config: unknown): Set<string> {
	if (!config || typeof config !== 'object') {
		return new Set<string>();
	}

	const typed = config as { packages?: Record<string, unknown> };
	if (!typed.packages || typeof typed.packages !== 'object') {
		return new Set<string>();
	}

	return new Set(Object.keys(typed.packages));
}

function validatePackageConsistency(config: unknown): void {
	if (!config || typeof config !== 'object') {
		return;
	}

	const typed = config as { packages?: Record<string, RawPackageValidationShape> };
	if (!typed.packages || typeof typed.packages !== 'object') {
		return;
	}

	const packageNames = getDeclaredPackageNames(config);

	for (const [packageName, packageConfig] of Object.entries(typed.packages)) {
		if (!packageConfig || typeof packageConfig !== 'object') {
			continue;
		}

		const dependencyKeys = Object.keys(packageConfig.dependencies || {});
		for (const dependencyName of dependencyKeys) {
			if (!packageNames.has(dependencyName)) {
				throw Object.assign(
					new Error(
						`Invalid config: dependency '${dependencyName}' in package '${packageName}' is not a declared package.`
					),
					{ code: 'CONFIG_INVALID', errorType: 'config' }
				);
			}
		}

		const ruleKeys = Object.keys(packageConfig.rules || {});
		for (const ruleKey of ruleKeys) {
			if (packageNames.has(ruleKey) || dependencyKeys.includes(ruleKey)) {
				throw Object.assign(
					new Error(
						`Invalid config: package '${packageName}' cannot define rule '${ruleKey}' because '${ruleKey}' is a declared package dependency.`
					),
					{ code: 'CONFIG_INVALID', errorType: 'config' }
				);
			}
		}
	}
}

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

	validatePackageConsistency(config);
}
