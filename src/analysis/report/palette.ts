import ansiColors from 'ansi-colors';
import type { MissingPolicy } from '../types';

export interface Palette {
	heading(value: string): string;
	divider: string;
	key(value: string): string;
	value(value: string): string;
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
		if (missingPolicy === 'ignore') {
			return apply(ansiColors.gray, value);
		}
		if (missingPolicy === 'warn') {
			return apply(ansiColors.yellow, value);
		}
		return apply(ansiColors.red, value);
	};

	const palette: Palette = {
		heading: wrap(ansiColors.white.bold),
		divider: apply(ansiColors.gray, '-----------------'),
		key: wrap(ansiColors.cyan),
		value: wrap(ansiColors.white),
		bool: (flag: boolean) =>
			flag ? apply(ansiColors.green, 'on') : apply(ansiColors.red, 'off'),
		bullet: '   •',
		subBullet: '      •',
		subDash: '         -',
		dot: useColor ? ansiColors.gray('•') : '•',
		muted: wrap(ansiColors.gray),
		externals: (
			label: string,
			{ missingPolicy = 'error', hasMissing }: ExternalsParams
		): string => {
			if (!hasMissing) {
				return apply(ansiColors.yellow, label);
			}
			return colorizeMissing(label, missingPolicy);
		},
		envName: (name: string, hasPaths: boolean): string =>
			hasPaths
				? apply(ansiColors.green, name)
				: apply(ansiColors.red, name),
		module: wrap(ansiColors.blue),
		folder: wrap(ansiColors.white),
		entry: wrap(ansiColors.green),
		external: wrap(ansiColors.yellow),
		error: wrap(ansiColors.red),
		warningHeader: wrap(ansiColors.yellow.bold),
		warning: wrap(ansiColors.yellow),
		errorHeader: wrap(ansiColors.red.bold),
		errorBullet: wrap(ansiColors.red),
		override: wrap(ansiColors.magenta),
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
				return apply(ansiColors.yellow, joined);
			}
			if (tags.includes('override')) {
				return apply(ansiColors.magenta, joined);
			}
			return apply(ansiColors.blue, joined);
		},
	};

	return palette;
}
