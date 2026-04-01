import {
	readConfigFile,
	detectConfigVersion,
	getValidator,
	hasObfuscationCliToggles,
	mergeConfig,
	normalizePathsV1,
	normalizePathsV2,
	normalizeToV2Config,
	buildLegacyFacade,
	collectWarnings,
	emitWarning,
	validateConfig,
} from './loader';
import type { CliOptions, LegacyFacadeOutput } from './loader';

export function loadConfig(cliOptions: CliOptions = {}): LegacyFacadeOutput {
	let fileConfig = {} as import('./loader/types').RawConfig;
	let baseDir: string | undefined;
	let configVersion = detectConfigVersion({});

	if (cliOptions.config) {
		const result = readConfigFile(cliOptions.config);
		fileConfig = result.config;
		baseDir = result.baseDir;
		configVersion = detectConfigVersion(fileConfig);
	}

	const merged = mergeConfig(fileConfig, cliOptions, configVersion);
	const hasObfuscationToggles = hasObfuscationCliToggles(cliOptions);

	const validatorInstance = getValidator(configVersion);

	const configCopy = JSON.parse(JSON.stringify(merged)) as typeof merged;
	validateConfig(validatorInstance, configCopy);

	const pathNormalized =
		configVersion === 'v2'
			? normalizePathsV2(configCopy, cliOptions, baseDir)
			: normalizePathsV1(configCopy, cliOptions, baseDir);

	const normalizedV2 = normalizeToV2Config(pathNormalized, configVersion);
	const outputConfig: LegacyFacadeOutput = buildLegacyFacade(normalizedV2);

	outputConfig._warnings = collectWarnings({
		configVersion,
		mergedConfig: merged,
		hasObfuscationToggles,
	});
	outputConfig._configVersion = configVersion;

	for (const warning of outputConfig._warnings) {
		emitWarning(warning, cliOptions);
	}

	return outputConfig;
}
