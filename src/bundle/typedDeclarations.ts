import type { BundledModule } from './types';

const COMMENT_LINE_PATTERN = /^---(?!@diagnostic\b).*/;
const DECLARATION_CONTINUATION_PATTERN = /^(---@|---\|).*/;

interface ExtractedDeclaration {
	kind: 'class' | 'alias' | 'enum';
	name: string;
	block: string;
	normalizedBlock: string;
	moduleName: string;
	filePath: string;
}

interface ProcessedTypedModules {
	declarationsBlock: string;
	modules: BundledModule[];
}

export function processTypedModules(bundledModules: BundledModule[]): ProcessedTypedModules {
	const declarationsByName = new Map<string, ExtractedDeclaration>();
	const orderedDeclarations: ExtractedDeclaration[] = [];
	const modules = bundledModules.map((moduleRecord) => {
		const extracted = extractTypedDeclarations(
			moduleRecord.content,
			moduleRecord.moduleName,
			moduleRecord.filePath
		);

		for (const declaration of extracted.declarations) {
			const existing = declarationsByName.get(declaration.name);
			if (!existing) {
				declarationsByName.set(declaration.name, declaration);
				orderedDeclarations.push(declaration);
				continue;
			}

			if (existing.normalizedBlock !== declaration.normalizedBlock) {
				throw new Error(
					[
						`Typed declaration conflict for '${declaration.name}'.`,
						`First declaration: ${existing.filePath} (${existing.moduleName})`,
						`Conflicting declaration: ${declaration.filePath} (${declaration.moduleName})`,
						`Existing: ${summarizeDeclaration(existing.block)}`,
						`Conflicting: ${summarizeDeclaration(declaration.block)}`,
					].join(' ')
				);
			}
		}

		return {
			...moduleRecord,
			content: extracted.content,
		};
	});

	return {
		declarationsBlock: orderedDeclarations.map((item) => item.block).join('\n\n'),
		modules,
	};
}

function extractTypedDeclarations(content: string, moduleName: string, filePath: string) {
	const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalizedContent.split('\n');
	const declarations: ExtractedDeclaration[] = [];
	const retainedLines: string[] = [];
	const consumedLines = new Set<number>();

	for (let index = 0; index < lines.length; index += 1) {
		if (consumedLines.has(index)) {
			continue;
		}

		const line = lines[index];
		const declarationStart = parseDeclarationStart(line);
		if (!declarationStart) {
			retainedLines.push(line);
			continue;
		}

		const declarationStartIndex = findLeadingCommentStart(lines, index);
		const retainedLeadingCommentCount = index - declarationStartIndex;
		if (retainedLeadingCommentCount > 0) {
			retainedLines.splice(-retainedLeadingCommentCount, retainedLeadingCommentCount);
		}
		const blockLines = lines.slice(declarationStartIndex, index + 1);
		let scanIndex = index + 1;
		while (scanIndex < lines.length && DECLARATION_CONTINUATION_PATTERN.test(lines[scanIndex])) {
			blockLines.push(lines[scanIndex]);
			scanIndex += 1;
		}

		for (let consumedIndex = declarationStartIndex; consumedIndex < scanIndex; consumedIndex += 1) {
			consumedLines.add(consumedIndex);
		}

		declarations.push({
			kind: declarationStart.kind,
			name: declarationStart.name,
			block: blockLines.join('\n'),
			normalizedBlock: normalizeDeclarationBlock(blockLines),
			moduleName,
			filePath,
		});

		index = scanIndex - 1;
	}

	return {
		declarations,
		content: retainedLines.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n'),
	};
}

function normalizeDeclarationBlock(lines: string[]): string {
	return lines.map((line) => line.trimEnd()).join('\n').trim();
}

function parseDeclarationStart(
	line: string
): Pick<ExtractedDeclaration, 'kind' | 'name'> | null {
	const classMatch = line.match(
		/^---@class\s+(?:\((?:exact)\)\s+)?([A-Za-z_][A-Za-z0-9_.]*)\b/
	);
	if (classMatch) {
		return {
			kind: 'class',
			name: classMatch[1],
		};
	}

	const enumMatch = line.match(
		/^---@enum\s+(?:\((?:key)\)\s+)?([A-Za-z_][A-Za-z0-9_.]*)\b/
	);
	if (enumMatch) {
		return {
			kind: 'enum',
			name: enumMatch[1],
		};
	}

	const aliasMatch = line.match(/^---@alias\s+([A-Za-z_][A-Za-z0-9_.]*)\b/);
	if (aliasMatch) {
		return {
			kind: 'alias',
			name: aliasMatch[1],
		};
	}

	return null;
}

function findLeadingCommentStart(lines: string[], declarationIndex: number): number {
	let startIndex = declarationIndex;
	for (let index = declarationIndex - 1; index >= 0; index -= 1) {
		const line = lines[index];
		if (line.trim() === '') {
			break;
		}
		if (!COMMENT_LINE_PATTERN.test(line)) {
			break;
		}
		startIndex = index;
	}
	return startIndex;
}

function summarizeDeclaration(block: string): string {
	return block.replace(/\s+/g, ' ').trim();
}