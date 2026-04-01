import { OBSOLETE_OBFUSCATION_WARNING } from './constants';
import { hasOwn } from './utils';
import type { CliOptions, ConfigVersion, RawConfig } from './types';

export function emitWarning(message: string, cliOptions: CliOptions): void {
	if (typeof cliOptions.onWarning === 'function') {
		cliOptions.onWarning(message);
		return;
	}
	console.warn(message);
}

export function collectWarnings({
	configVersion,
	mergedConfig,
	hasObfuscationToggles,
}: {
	configVersion: ConfigVersion;
	mergedConfig: RawConfig;
	hasObfuscationToggles: boolean;
}): string[] {
	const warnings: string[] = [];
	const hasLegacyObfuscation =
		configVersion === 'v1' && hasOwn(mergedConfig, 'obfuscation');

	if (hasLegacyObfuscation) {
		warnings.push(OBSOLETE_OBFUSCATION_WARNING);
	}
	if (hasObfuscationToggles) {
		warnings.push(OBSOLETE_OBFUSCATION_WARNING);
	}

	return Array.from(new Set(warnings));
}
