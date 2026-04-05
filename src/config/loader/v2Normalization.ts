import path from 'path';

import { MISSING_POLICIES, BUNDLE_MODES, FALLBACK_MODES, RULE_MODES } from './constants';
import type {
	MissingPolicy,
	BundleMode,
	FallbackMode,
	RuleMode,
	NormalizedRule,
	RawConfig,
	RawModules,
	V2Config,
} from './types';

function normalizeRuleMode(mode: unknown): RuleMode {
	if (typeof mode === 'string' && RULE_MODES.has(mode)) {
		return mode as RuleMode;
	}
	return 'bundle';
}

function normalizeModuleRules(
	rules: RawModules['rules'] | undefined
): Record<string, NormalizedRule> {
	if (!rules || typeof rules !== 'object') {
		return {};
	}

	const normalized: Record<string, NormalizedRule> = {};
	for (const [moduleId, rule] of Object.entries(rules)) {
		if (!rule) {
			continue;
		}

		const entry: NormalizedRule = { mode: normalizeRuleMode(rule.mode) };
		if (typeof rule.path === 'string' && rule.path.length > 0) {
			entry.path = rule.path;
		}
		if (typeof rule.recursive === 'boolean') {
			entry.recursive = rule.recursive;
		}
		normalized[moduleId] = entry;
	}

	return normalized;
}

function uniquePaths(paths: unknown[]): string[] {
	const output: string[] = [];
	const seen = new Set<string>();
	for (const value of paths) {
		if (typeof value !== 'string' || value.length === 0) {
			continue;
		}
		if (seen.has(value)) {
			continue;
		}
		seen.add(value);
		output.push(value);
	}
	return output;
}


export function normalizeToV2Config(config: RawConfig): V2Config {
	const modules = config.modules || {};
	const roots = uniquePaths(
		Array.isArray(modules.roots) && modules.roots.length > 0
			? modules.roots
			: [path.dirname(config.entry!)]
	);
	const env = Array.isArray(modules.env)
		? modules.env.filter((value) => typeof value === 'string' && value.length > 0)
		: [];
	const missing = (
		typeof modules.missing === 'string' && MISSING_POLICIES.has(modules.missing)
			? modules.missing
			: 'error'
	) as MissingPolicy;
	const bundle = config.bundle || {};
	const bundleMode = (
		typeof bundle.mode === 'string' && BUNDLE_MODES.has(bundle.mode)
			? bundle.mode
			: 'runtime'
	) as BundleMode;
	const fallback = (
		typeof bundle.fallback === 'string' && FALLBACK_MODES.has(bundle.fallback)
			? bundle.fallback
			: 'external-only'
	) as FallbackMode;

	return {
		schemaVersion: 2,
		entry: config.entry!,
		output: config.output!,
		modules: {
			roots,
			env,
			missing,
			rules: normalizeModuleRules(modules.rules),
		},
		bundle: { mode: bundleMode, fallback },
		_compat: { externalRecursive: true },
	};
}
