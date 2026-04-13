import ansiColors from 'ansi-colors';
import type { MissingPolicy } from '../types';

export interface Palette {
	reportHeader(value: string, mode: 'bundle' | 'analysis'): string;
	heading(value: string): string;
	divider: string;
	key(value: string): string;
	value(value: string): string;
	statusValue(value: string, status: 'ok' | 'warn' | 'failed'): string;
	bool(flag: boolean): string;
	bullet: string;
	subBullet: string;
	subDash: string;
	dot: string;
	muted(value: string): string;
	externals(
		label: string,
		params: { missingPolicy?: MissingPolicy; hasMissing: boolean }
	): string;
	envName(name: string, hasPaths: boolean): string;
	module(value: string): string;
	folder(value: string): string;
	entry(value: string): string;
	external(value: string): string;
	error(value: string): string;
	warningHeader(value: string): string;
	warning(value: string): string;
	errorHeader(value: string): string;
	errorBullet(value: string): string;
	override(value: string): string;
	packageToken(value: string, packageName: string): string;
	graphTag(
		value: string,
		tag: string,
		options?: { missingPolicy?: MissingPolicy }
	): string;
	graphRefDefinition(value: string): string;
	graphRefPointer(value: string): string;
	moduleLabel(
		label: string,
		tags?: string[],
		options?: { missingPolicy?: MissingPolicy }
	): string;
}

export interface PaletteOptions {
	useColor?: boolean;
}

type ColorFn = (value: string) => string;

type ExternalsParams = { missingPolicy?: MissingPolicy; hasMissing: boolean };

type ModuleLabelOptions = { missingPolicy?: MissingPolicy };

const PACKAGE_COLOR_FNS: ColorFn[] = [
	ansiColors.green,
	ansiColors.cyan,
	ansiColors.blue,
	ansiColors.greenBright,
	ansiColors.cyanBright,
	ansiColors.blueBright,
];

export function createPalette({
	useColor = true,
}: PaletteOptions = {}): Palette {
	const apply = (fn: ColorFn, value: string): string =>
		useColor ? fn(value) : value;
	const wrap =
		(fn: ColorFn): ColorFn =>
		(value) =>
			apply(fn, value);
	const colorizeMissing = (
		value: string,
		missingPolicy: MissingPolicy = 'error'
	): string => {
		if (missingPolicy === 'warn') {
			return apply(ansiColors.yellow, value);
		}
		return apply(ansiColors.red, value);
	};
	const packageColorByName = new Map<string, ColorFn>();
	let nextPackageColorIndex = 0;
	const colorizePackageToken = (value: string, packageName: string): string => {
		let formatter = packageColorByName.get(packageName);
		if (!formatter) {
			formatter =
				PACKAGE_COLOR_FNS[
					nextPackageColorIndex % PACKAGE_COLOR_FNS.length
				];
			packageColorByName.set(packageName, formatter);
			nextPackageColorIndex += 1;
		}
		return apply(formatter, value);
	};
	const colorizeGraphTag = (
		value: string,
		tag: string,
		missingPolicy: MissingPolicy = 'error'
	): string => {
		if (tag === 'missing') {
			return colorizeMissing(value, missingPolicy);
		}
		if (tag === 'circular') {
			return apply(ansiColors.red, value);
		}
		if (tag === 'ref') {
			return apply(ansiColors.whiteBright, value);
		}
		if (tag === 'ignored') {
			return apply(ansiColors.gray, value);
		}
		if (tag === 'non-recursive') {
			return apply(ansiColors.gray, value);
		}
		if (tag === 'external') {
			return apply(ansiColors.magenta, value);
		}
		return value;
	};

	const palette: Palette = {
		reportHeader: (value: string, mode: 'bundle' | 'analysis') => {
			if (!useColor) {
				return value;
			}
			const formatter =
				mode === 'bundle'
					? ansiColors.bgGreen.black
					: ansiColors.bgCyan.black;
			return apply(formatter, ` ${value} `);
		},
		heading: wrap(ansiColors.white.bold),
		divider: apply(ansiColors.gray, '-----------------'),
		key: wrap(ansiColors.white),
		value: wrap(ansiColors.white),
		statusValue: (
			value: string,
			status: 'ok' | 'warn' | 'failed'
		): string => {
			if (status === 'failed') {
				return apply(ansiColors.red, value);
			}
			if (status === 'warn') {
				return apply(ansiColors.yellow, value);
			}
			return apply(ansiColors.green, value);
		},
		bool: (flag: boolean) =>
			flag ? apply(ansiColors.green, 'on') : apply(ansiColors.red, 'off'),
		bullet: '   •',
		subBullet: '      •',
		subDash: '         -',
		dot: useColor ? ansiColors.gray('•') : '•',
		muted: wrap(ansiColors.gray),
		externals: (label: string, _params: ExternalsParams): string =>
			apply(ansiColors.magenta, label),
		envName: (name: string, hasPaths: boolean): string =>
			hasPaths
				? apply(ansiColors.green, name)
				: apply(ansiColors.red, name),
		module: wrap(ansiColors.white),
		folder: wrap(ansiColors.white),
		entry: wrap(ansiColors.white),
		external: wrap(ansiColors.magenta),
		error: wrap(ansiColors.red),
		warningHeader: wrap(ansiColors.yellow.bold),
		warning: wrap(ansiColors.yellow),
		errorHeader: wrap(ansiColors.red.bold),
		errorBullet: wrap(ansiColors.red),
		override: wrap(ansiColors.magenta),
		packageToken: (value: string, packageName: string): string =>
			colorizePackageToken(value, packageName),
		graphRefDefinition: wrap(ansiColors.cyanBright),
		graphRefPointer: wrap(ansiColors.gray),
		graphTag: (
			value: string,
			tag: string,
			options: ModuleLabelOptions = {}
		): string => colorizeGraphTag(value, tag, options.missingPolicy),
		moduleLabel: (
			label: string,
			tags: string[] = [],
			options: ModuleLabelOptions = {}
		): string => {
			const suffix = tags.length > 0 ? ` (${tags.join(', ')})` : '';
			const joined = `${label}${suffix}`;
			const missingPolicy = options.missingPolicy ?? 'error';
			const hasMissing = tags.includes('missing');
			const hasExternal = tags.includes('external');
			if (hasMissing && hasExternal) {
				return colorizeMissing(joined, missingPolicy);
			}
			if (hasMissing) {
				return colorizeMissing(joined, missingPolicy);
			}
			if (hasExternal) {
				return apply(ansiColors.magenta, joined);
			}
			if (tags.includes('override')) {
				return apply(ansiColors.magenta, joined);
			}
			return apply(ansiColors.white, joined);
		},
	};

	return palette;
}
