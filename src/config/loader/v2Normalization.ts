import path from 'path';

import { MISSING_POLICIES, FALLBACK_MODES, RULE_MODES } from './constants';
import type {
	EntryKind,
	MissingPolicy,
	FallbackMode,
	RuleMode,
	NormalizedRule,
	NormalizedDependencyPolicy,
	RawConfig,
	RawPackage,
	RawPackages,
	V2Packages,
	V2Config,
} from './types';

function normalizeRuleMode(mode: unknown): RuleMode {
	if (typeof mode === 'string' && RULE_MODES.has(mode)) {
		return mode as RuleMode;
	}
	return 'bundle';
}

function normalizeModuleRules(
	rules: RawPackage['rules'] | undefined
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
		if (
			entry.mode === 'bundle' &&
			typeof rule.path === 'string' &&
			rule.path.length > 0
		) {
			entry.path = rule.path;
		}
		if (typeof rule.recursive === 'boolean') {
			entry.recursive = rule.recursive;
		}
		normalized[moduleId] = entry;
	}

	return normalized;
}

export function collectConfigWarnings(config: RawConfig): string[] {
	const warnings: string[] = [];

	for (const [packageName, rawPackage] of Object.entries(config.packages || {})) {
		if (!rawPackage || typeof rawPackage !== 'object') {
			continue;
		}

		for (const [moduleId, rule] of Object.entries(rawPackage.rules || {})) {
			if (!rule || typeof rule !== 'object') {
				continue;
			}

			const mode = normalizeRuleMode(rule.mode);
			if (
				(mode === 'external' || mode === 'ignore') &&
				typeof rule.path === 'string' &&
				rule.path.length > 0
			) {
				warnings.push(
					`Config warning: rule '${packageName}.${moduleId}' sets mode '${mode}' and path '${rule.path}'. The path will be ignored.`
				);
			}
		}
	}

	return warnings;
}

function normalizeDependencies(
	dependencies: RawPackage['dependencies'] | undefined
): Record<string, NormalizedDependencyPolicy> {
	if (!dependencies || typeof dependencies !== 'object') {
		return {};
	}

	const normalized: Record<string, NormalizedDependencyPolicy> = {};
	for (const [packageName, policy] of Object.entries(dependencies)) {
		if (!policy || typeof policy !== 'object') {
			continue;
		}

		normalized[packageName] = {
			mode: normalizeRuleMode(policy.mode),
			recursive:
				typeof policy.recursive === 'boolean'
					? policy.recursive
					: true,
		};
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

function normalizePackages(
	rawPackages: RawPackages | undefined,
	defaultRoot: string
): V2Packages {
	const normalized: V2Packages = {};
	for (const [packageName, rawPackage] of Object.entries(rawPackages || {})) {
		if (!rawPackage || typeof rawPackage !== 'object') {
			continue;
		}

		if (typeof rawPackage.root !== 'string' || rawPackage.root.length === 0) {
			continue;
		}

		normalized[packageName] = {
			root: rawPackage.root,
			dependencies: normalizeDependencies(rawPackage.dependencies),
			rules: normalizeModuleRules(rawPackage.rules),
		};
	}

	if (!normalized.default) {
		normalized.default = {
			root: defaultRoot,
			dependencies: {},
			rules: {},
		};
	} else {
		normalized.default = {
			...normalized.default,
			dependencies: normalized.default.dependencies || {},
			rules: normalized.default.rules || {},
		};
	}

	return normalized;
}

function resolveEntryKind(entryPath: string, defaultRoot: string): EntryKind {
	const relative = path.relative(defaultRoot, entryPath);
	const isWithinRoot =
		!relative.startsWith('..') &&
		!path.isAbsolute(relative) &&
		relative.length > 0;
	return isWithinRoot ? 'package-module' : 'bootstrap';
}

export function normalizeToV2Config(config: RawConfig): V2Config {
	const defaultRootCandidate =
		(typeof config.packages?.default?.root === 'string' &&
		config.packages?.default?.root.length > 0
			? config.packages.default.root
				: path.dirname(config.entry!)) ?? path.dirname(config.entry!);
	const packages = normalizePackages(config.packages, defaultRootCandidate);
	const defaultRoot = packages.default?.root || defaultRootCandidate;
	const missing = (
		typeof config.missing === 'string' &&
		MISSING_POLICIES.has(config.missing)
			? config.missing
			: 'error'
	) as MissingPolicy;
	const bundle = config.bundle || {};
	const fallback = (
		typeof bundle.fallback === 'string' &&
		FALLBACK_MODES.has(bundle.fallback)
			? bundle.fallback
			: 'external-only'
	) as FallbackMode;

	return {
		schemaVersion: 2,
		entry: config.entry!,
		output: config.output!,
		missing,
		packages,
		bundle: { fallback },
		_internal: {
			entryPackage: 'default',
			entryKind: resolveEntryKind(config.entry!, defaultRoot),
		},
	};
}
