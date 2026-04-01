export const MISSING_POLICIES = new Set<string>(['error', 'warn', 'ignore']);
export const BUNDLE_MODES = new Set<string>(['runtime', 'typed']);
export const FALLBACK_MODES = new Set<string>(['never', 'external-only', 'always']);
export const RULE_MODES = new Set<string>(['bundle', 'external', 'ignore']);

export const OBSOLETE_OBFUSCATION_WARNING =
	'Internal obfuscation was removed in LuaPack v2. Obfuscation settings are ignored; use an external post-processing tool after packing.';
