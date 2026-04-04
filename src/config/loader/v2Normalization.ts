import path from 'path';

import { MISSING_POLICIES, BUNDLE_MODES, FALLBACK_MODES, RULE_MODES } from './constants';
import type {
	ConfigVersion,
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

export function normalizeToV2Config(config: RawConfig, version: ConfigVersion): V2Config {
	if (version === 'v2') {
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

	// v1 upcast
	const modulesConfig = config.modules || {};
	const externalConfig = modulesConfig.external || {};
	const sourceRoot = config.sourceRoot || path.dirname(config.entry!);
	const externalPaths = Array.isArray(externalConfig.paths) ? externalConfig.paths : [];
	const env = Array.isArray(externalConfig.env) ? externalConfig.env : ['LUA_PATH'];
	const bundleConfig = config.bundle || {};
	const rules: Record<string, NormalizedRule> = {};

	const ignored = Array.isArray(modulesConfig.ignore) ? modulesConfig.ignore : [];
	for (const moduleId of ignored) {
		rules[moduleId] = { mode: 'ignore' };
	}

	const overrides =
		modulesConfig.overrides && typeof modulesConfig.overrides === 'object'
			? modulesConfig.overrides
			: {};
	for (const [moduleId, override] of Object.entries(overrides)) {
		if (rules[moduleId] && rules[moduleId].mode === 'ignore') {
			continue;
		}
		if (!override || typeof override !== 'object') {
			continue;
		}

		const entry: NormalizedRule = { mode: 'bundle' };
		if (typeof override.path === 'string' && override.path.length > 0) {
			entry.path = path.isAbsolute(override.path)
				? override.path
				: path.resolve(sourceRoot, override.path);
		}
		if (typeof override.recursive === 'boolean') {
			entry.recursive = override.recursive;
		}
		rules[moduleId] = entry;
	}

	return {
		schemaVersion: 2,
		entry: config.entry!,
		output: config.output!,
		modules: {
			roots: uniquePaths([sourceRoot, ...externalPaths]),
			env: env.filter((value) => typeof value === 'string' && value.length > 0),
			missing: modulesConfig.ignoreMissing ? 'warn' : 'error',
			rules,
		},
		bundle: {
			mode:
				typeof bundleConfig.mode === 'string' && BUNDLE_MODES.has(bundleConfig.mode)
					? (bundleConfig.mode as BundleMode)
					: 'runtime',
			fallback:
				typeof bundleConfig.fallback === 'string' && FALLBACK_MODES.has(bundleConfig.fallback)
					? (bundleConfig.fallback as FallbackMode)
					: 'external-only',
		},
		_compat: {
			externalRecursive:
				typeof externalConfig.recursive === 'boolean'
					? externalConfig.recursive
					: true,
		},
	};
}
