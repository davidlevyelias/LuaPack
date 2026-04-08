import path from 'path';

import { buildDefaultOutputPath } from './utils';
import type {
	CliOptions,
	RawConfig,
	RawPackage,
	RawPackages,
} from './types';

function normalizeRulePaths(
	rules: RawPackage['rules'] | undefined,
	baseDir: string
): RawPackage['rules'] {
	if (!rules || typeof rules !== 'object') {
		return rules;
	}

	const normalizedRules: NonNullable<RawPackage['rules']> = {};
	for (const [moduleId, rule] of Object.entries(rules)) {
		if (!rule) {
			continue;
		}
		if (typeof rule.path === 'string') {
			normalizedRules[moduleId] = {
				...rule,
				path: path.isAbsolute(rule.path)
					? rule.path
					: path.resolve(baseDir, rule.path),
			};
		} else {
			normalizedRules[moduleId] = rule;
		}
	}

	return normalizedRules;
}

function normalizePackages(
	rawPackages: RawPackages | undefined,
	baseDir: string
): RawPackages | undefined {
	if (!rawPackages || typeof rawPackages !== 'object') {
		return rawPackages;
	}

	const normalized: RawPackages = {};
	for (const [packageName, rawPackage] of Object.entries(rawPackages)) {
		if (!rawPackage || typeof rawPackage !== 'object') {
			continue;
		}

		const packageConfig: RawPackage = { ...rawPackage };
		if (typeof packageConfig.root === 'string' && packageConfig.root) {
			packageConfig.root = path.isAbsolute(packageConfig.root)
				? packageConfig.root
				: path.resolve(baseDir, packageConfig.root);
		}

		packageConfig.rules = normalizeRulePaths(packageConfig.rules, baseDir);
		normalized[packageName] = packageConfig;
	}

	return normalized;
}

export function normalizePaths(
	config: RawConfig,
	cliOptions: CliOptions,
	fileBaseDir: string | undefined
): RawConfig {
	const finalConfig: RawConfig = { ...config };
	const cwd = process.cwd();
	const baseDir = fileBaseDir || cwd;

	if (finalConfig.entry) {
		const origin = cliOptions.entry ? cwd : baseDir;
		finalConfig.entry = path.resolve(origin, finalConfig.entry);
	}

	if (finalConfig.output) {
		const origin = cliOptions.output ? cwd : baseDir;
		finalConfig.output = path.resolve(origin, finalConfig.output);
	}

	if (!finalConfig.output && finalConfig.entry) {
		finalConfig.output = buildDefaultOutputPath(finalConfig.entry);
	}

	finalConfig.packages = normalizePackages(finalConfig.packages, baseDir);
	return finalConfig;
}
