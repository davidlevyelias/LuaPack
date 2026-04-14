import * as fs from 'node:fs';
import * as path from 'node:path';

import type { LuaVersion, MissingPolicy } from '../../config/loader';
import logger from '../../utils/Logger';

import type { CliOptions } from '../types';

type InitAnswers = {
	entry: string;
	output: string;
	root: string;
	luaVersion: LuaVersion;
	missing?: MissingPolicy;
	filePath: string;
};

const SCHEMA_URL =
	'https://raw.githubusercontent.com/davidlevyelias/LuaPack/refs/heads/main/config.schema.json';

// Dynamic import wrapper — prevents TypeScript (module: "commonjs") from
// rewriting import() to require(), which would fail for ESM-only packages.
function loadInquirer(): Promise<typeof import('@inquirer/prompts')> {
	return new Function('return import("@inquirer/prompts")')() as Promise<
		typeof import('@inquirer/prompts')
	>;
}

function normalizePromptValue(
	value: string | undefined,
	defaultValue: string
): string {
	const normalized = (value || '').trim();
	return normalized || defaultValue;
}

function buildInitConfigPayload(answers: InitAnswers): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		$schema: SCHEMA_URL,
		schemaVersion: 2,
		entry: answers.entry,
		output: answers.output,
		luaVersion: answers.luaVersion,
		packages: {
			default: {
				root: answers.root,
			},
		},
	};

	if (answers.missing) {
		payload.missing = answers.missing;
	}

	return payload;
}

async function promptInitAnswers(
	options: CliOptions,
	defaults: {
		entry: string;
		output: string;
		root: string;
		luaVersion: LuaVersion;
		filePath: string;
	}
): Promise<InitAnswers> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw Object.assign(
			new Error('Interactive init requires a TTY. Use --yes to skip prompts.'),
			{ errorType: 'usage', code: 'TTY_REQUIRED' }
		);
	}

	const { input, select } = await loadInquirer();

	logger.info('');
	logger.info('LuaPack Configuration Generator');

	const entry = await input({
		message: 'Entry Lua file:',
		default: normalizePromptValue(options.entry, defaults.entry),
		validate: (v) => v.trim() !== '' || 'A file path is required.',
	});

	const output = await input({
		message: 'Output bundle path:',
		default: normalizePromptValue(options.output, defaults.output),
		validate: (v) => v.trim() !== '' || 'A file path is required.',
	});

	const root = await input({
		message: 'Default package root:',
		default: normalizePromptValue(options.root, defaults.root),
		validate: (v) => v.trim() !== '' || 'A directory path is required.',
	});

	const luaVersion = await select<LuaVersion>({
		message: 'Lua grammar version:',
		default: options.luaVersion || defaults.luaVersion,
		choices: [
			{ value: '5.1', name: '5.1' },
			{ value: '5.2', name: '5.2' },
			{ value: '5.3', name: '5.3' },
			{ value: 'LuaJIT', name: 'LuaJIT' },
		],
	});

	const missingAnswer = await select<MissingPolicy | ''>({
		message: 'Missing-module policy:',
		default: options.missing || '',
		choices: [
			{ value: '', name: 'omit  — use LuaPack default' },
			{ value: 'error', name: 'error — fail if a required module cannot be found' },
			{ value: 'warn', name: 'warn  — continue with a warning' },
		],
	});

	const filePath = await input({
		message: 'Config file path:',
		default: normalizePromptValue(options.file, defaults.filePath),
		validate: (v) => v.trim() !== '' || 'A file path is required.',
	});

	return {
		entry,
		output,
		root,
		luaVersion,
		missing: missingAnswer || undefined,
		filePath,
	};
}

async function confirmOverwrite(filePath: string): Promise<boolean> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return false;
	}

	const { confirm } = await loadInquirer();

	return confirm({
		message: `File '${filePath}' already exists. Overwrite?`,
		default: false,
	});
}

export async function runInitWorkflow(options: CliOptions) {
	const defaults = {
		entry: './init.lua',
		output: 'dist/bundle.lua',
		root: './',
		luaVersion: options.luaVersion || '5.3',
		filePath: options.file || 'luapack.config.json',
	};

	const answers: InitAnswers = options.yes
		? {
				entry: normalizePromptValue(options.entry, defaults.entry),
				output: normalizePromptValue(options.output, defaults.output),
				root: normalizePromptValue(options.root, defaults.root),
				luaVersion: options.luaVersion || defaults.luaVersion,
				missing: options.missing,
				filePath: normalizePromptValue(options.file, defaults.filePath),
			}
		: await promptInitAnswers(options, defaults);

	const payload = buildInitConfigPayload(answers);
	const serialized = JSON.stringify(payload, null, 2);

	logger.info('');
	logger.info('Generated config preview:');
	logger.info('------------------------');
	logger.info(serialized);
	logger.info('------------------------');

	const targetPath = path.resolve(answers.filePath);
	const exists = fs.existsSync(targetPath);

	if (exists && !options.force) {
		if (options.yes) {
			throw Object.assign(
				new Error(
					`Config file already exists: ${answers.filePath}. Use --force to overwrite.`
				),
				{ errorType: 'usage', code: 'CONFIG_EXISTS' }
			);
		}

		const shouldOverwrite = await confirmOverwrite(answers.filePath);
		if (!shouldOverwrite) {
			logger.info('Init canceled.');
			return;
		}
	}

	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.writeFileSync(targetPath, `${serialized}\n`, 'utf-8');
	logger.info('');
	logger.info(`Config saved to: ${targetPath}`);
}
