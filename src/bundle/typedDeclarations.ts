import type { BundledModule } from './types';

const DECLARATION_START_PATTERN = /^---@(class|alias|enum)\s+([A-Za-z_][A-Za-z0-9_.]*)\b/;

interface ExtractedDeclaration {
	kind: 'class' | 'alias' | 'enum';
	name: string;
	block: string;
	normalizedBlock: string;
	moduleName: string;
}

interface ProcessedTypedModules {
	declarationsBlock: string;
	modules: BundledModule[];
}

export function processTypedModules(bundledModules: BundledModule[]): ProcessedTypedModules {
	const declarationsByName = new Map<string, ExtractedDeclaration>();
	const orderedDeclarations: ExtractedDeclaration[] = [];
	const modules = bundledModules.map((moduleRecord) => {
		const extracted = extractTypedDeclarations(moduleRecord.content, moduleRecord.moduleName);

		for (const declaration of extracted.declarations) {
			const existing = declarationsByName.get(declaration.name);
			if (!existing) {
				declarationsByName.set(declaration.name, declaration);
				orderedDeclarations.push(declaration);
				continue;
			}

			if (existing.normalizedBlock !== declaration.normalizedBlock) {
				throw new Error(
					`Typed declaration conflict for '${declaration.name}' between modules '${existing.moduleName}' and '${declaration.moduleName}'.`
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

function extractTypedDeclarations(content: string, moduleName: string) {
	const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalizedContent.split('\n');
	const declarations: ExtractedDeclaration[] = [];
	const retainedLines: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const startMatch = line.match(DECLARATION_START_PATTERN);
		if (!startMatch) {
			retainedLines.push(line);
			continue;
		}

		const blockLines = [line];
		let scanIndex = index + 1;
		while (scanIndex < lines.length && lines[scanIndex].startsWith('---@')) {
			blockLines.push(lines[scanIndex]);
			scanIndex += 1;
		}

		declarations.push({
			kind: startMatch[1] as ExtractedDeclaration['kind'],
			name: startMatch[2],
			block: blockLines.join('\n'),
			normalizedBlock: normalizeDeclarationBlock(blockLines),
			moduleName,
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