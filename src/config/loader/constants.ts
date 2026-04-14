export const MISSING_POLICIES = new Set<string>(['error', 'warn']);
export const LUA_VERSIONS = new Set<string>(['5.1', '5.2', '5.3', 'LuaJIT']);
export const FALLBACK_MODES = new Set<string>([
	'never',
	'external-only',
	'always',
]);
export const RULE_MODES = new Set<string>(['bundle', 'external', 'ignore']);
