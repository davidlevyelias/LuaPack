import path from 'path';

import type { V2Config, LegacyFacadeOutput } from './types';

export function buildLegacyFacade(v2Config: V2Config): LegacyFacadeOutput {
	const roots = Array.isArray(v2Config.modules?.roots)
		? v2Config.modules.roots
		: [path.dirname(v2Config.entry)];
	const sourceRoot = roots[0] || path.dirname(v2Config.entry);
	const externalPaths = roots.slice(1);
	const env = Array.isArray(v2Config.modules?.env) ? [...v2Config.modules.env] : [];
	const rules = v2Config.modules?.rules || {};

	const ignore: string[] = [];
	const overrides: LegacyFacadeOutput['modules']['overrides'] = {};

	for (const [moduleId, rule] of Object.entries(rules)) {
		if (!rule || typeof rule !== 'object') {
			continue;
		}

		if (rule.mode === 'ignore') {
			ignore.push(moduleId);
			continue;
		}

		if (typeof rule.path === 'string' || typeof rule.recursive === 'boolean') {
			overrides[moduleId] = {};
			if (typeof rule.path === 'string') {
				overrides[moduleId].path = rule.path;
			}
			if (typeof rule.recursive === 'boolean') {
				overrides[moduleId].recursive = rule.recursive;
			}
		}
	}

	return {
		schemaVersion: 2,
		entry: v2Config.entry,
		output: v2Config.output,
		_analyzeOnly: false,
		sourceRoot,
		modules: {
			ignoreMissing: v2Config.modules.missing !== 'error',
			ignore,
			external: {
				enabled: externalPaths.length > 0 || env.length > 0,
				recursive:
					typeof v2Config._compat?.externalRecursive === 'boolean'
						? v2Config._compat.externalRecursive
						: true,
				paths: externalPaths,
				env,
			},
			overrides,
		},
		bundle: { ...v2Config.bundle },
		_v2: v2Config,
	};
}
