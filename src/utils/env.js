const path = require('path');

function normalizeEnvNames(envConfig) {
	if (!Array.isArray(envConfig)) {
		return undefined;
	}
	return envConfig
		.map((value) => (typeof value === 'string' ? value.trim() : ''))
		.filter((value) => value.length > 0);
}

function splitEnvValue(value) {
	if (typeof value !== 'string' || value.length === 0) {
		return [];
	}
	return value.split(';');
}

function normalizeEnvEntry(entry, sourceRoot) {
	const trimmed = entry.trim();
	if (!trimmed) {
		return null;
	}
	const questionIndex = trimmed.indexOf('?');
	let withoutPattern = questionIndex === -1 ? trimmed : trimmed.slice(0, questionIndex);

	if (!withoutPattern) {
		return null;
	}

	withoutPattern = withoutPattern.replace(/[\\/]+$/, '');
	if (!withoutPattern) {
		return null;
	}

	if (path.isAbsolute(withoutPattern)) {
		return withoutPattern;
	}

	const base = sourceRoot || process.cwd();
	return path.resolve(base, withoutPattern);
}

function resolveExternalEnv({ envConfig, sourceRoot }) {
	const normalizedConfig = normalizeEnvNames(envConfig);
	const hasExplicitConfig = Array.isArray(envConfig);
	const envNames = normalizedConfig ?? ['LUA_PATH'];

	const pathsByEnv = {};
	const aggregated = [];
	const aggregateSet = new Set();

	for (const envName of envNames) {
		const rawValue = process.env[envName];
		const resolvedPaths = [];

		if (typeof rawValue === 'string' && rawValue.length > 0) {
			for (const entry of splitEnvValue(rawValue)) {
				const normalized = normalizeEnvEntry(entry, sourceRoot);
				if (!normalized) {
					continue;
				}
				if (!resolvedPaths.includes(normalized)) {
					resolvedPaths.push(normalized);
				}
				if (!aggregateSet.has(normalized)) {
					aggregateSet.add(normalized);
					aggregated.push(normalized);
				}
			}
		}

		pathsByEnv[envName] = resolvedPaths;
	}

	return {
		hasExplicitConfig,
		envNames,
		pathsByEnv,
		allPaths: aggregated,
	};
}

module.exports = {
	resolveExternalEnv,
};
