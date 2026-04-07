import path from 'path';

import { buildDefaultOutputPath } from './utils';
import type { CliOptions, RawConfig, RawModules } from './types';

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

	const modules = { ...(finalConfig.modules || {}) };

	if (Array.isArray(modules.roots)) {
		modules.roots = modules.roots.map((rootPath) =>
			path.isAbsolute(rootPath)
				? rootPath
				: path.resolve(baseDir, rootPath)
		);
	}

	if (modules.rules && typeof modules.rules === 'object') {
		const normalizedRules: NonNullable<RawModules['rules']> = {};
		for (const [moduleId, rule] of Object.entries(modules.rules)) {
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
		modules.rules = normalizedRules;
	}

	finalConfig.modules = modules;
	return finalConfig;
}
