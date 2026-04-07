import path from 'path';

export type ResolvedExternalEnv = {
	hasExplicitConfig: boolean;
	envNames: string[];
	pathsByEnv: Record<string, string[]>;
	allPaths: string[];
};

type ResolveExternalEnvOptions = {
	envConfig?: string[] | null;
	sourceRoot?: string | null;
};

function normalizeEnvNames(envConfig?: string[] | null): string[] | undefined {
	if (!Array.isArray(envConfig)) {
		return undefined;
	}

	return envConfig
		.map((value) => (typeof value === 'string' ? value.trim() : ''))
		.filter((value) => value.length > 0);
}

function splitEnvValue(value: string | undefined): string[] {
	if (typeof value !== 'string' || value.length === 0) {
		return [];
	}

	return value.split(';');
}

function normalizeEnvEntry(
	entry: string,
	sourceRoot?: string | null
): string | null {
	const trimmed = entry.trim();
	if (!trimmed) {
		return null;
	}

	const questionIndex = trimmed.indexOf('?');
	let withoutPattern =
		questionIndex === -1 ? trimmed : trimmed.slice(0, questionIndex);
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

export function resolveExternalEnv({
	envConfig,
	sourceRoot,
}: ResolveExternalEnvOptions): ResolvedExternalEnv {
	const normalizedConfig = normalizeEnvNames(envConfig);
	const hasExplicitConfig = Array.isArray(envConfig);
	const envNames = normalizedConfig ?? ['LUA_PATH'];

	const pathsByEnv: Record<string, string[]> = {};
	const aggregated: string[] = [];
	const aggregateSet = new Set<string>();

	for (const envName of envNames) {
		const rawValue = process.env[envName];
		const resolvedPaths: string[] = [];

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
