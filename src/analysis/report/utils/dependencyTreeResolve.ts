import path from 'path';

import type { MissingModuleRecord } from '../../types';
import type { ModuleNode } from './dependencyTreeInsert';
import { createFolderNode, decorateMissingParts } from './dependencyTreeInsert';

type ExternalPath = { path: string; key: string };

interface ResolvePathOptions {
	filePath: string;
	rootDir: string | null;
	externalSections: Map<string, ModuleNode>;
	externalPaths: ExternalPath[];
	sections: ModuleNode[];
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

interface ResolveMissingOptions {
	missing: MissingModuleRecord;
	rootDir: string | null;
	sections: ModuleNode[];
	externalSections: Map<string, ModuleNode>;
	externalPaths: ExternalPath[];
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

export interface DependencyTreeContext {
	sections: ModuleNode[];
	externalSections: Map<string, ModuleNode>;
	externalPaths: ExternalPath[];
	rootDir: string | null;
}

export function createDependencyTreeContext(
	rootDir: string | null,
	externalRoots: string[],
	formatPath: (targetPath: string | null | undefined) => string
): DependencyTreeContext {
	const rootSection = createFolderNode('[Root Dir]/');
	const normalizedRootDir = rootDir ? path.resolve(rootDir) : null;
	const baseForExternals = normalizedRootDir || process.cwd();
	const externalPaths = externalRoots.map((externalPath) => {
		const absolutePath = path.resolve(baseForExternals, externalPath);
		return {
			path: absolutePath,
			key: `${formatPath(absolutePath)}/`,
		};
	});

	return {
		sections: [rootSection],
		externalSections: new Map<string, ModuleNode>(),
		externalPaths,
		rootDir: normalizedRootDir,
	};
}

export function resolveSectionForFilePath({
	filePath,
	rootDir,
	externalSections,
	externalPaths,
	sections,
	formatPath,
	isWithinRoot,
}: ResolvePathOptions): { section: ModuleNode; relativeParts: string[] } {
	if (rootDir && isWithinRoot(filePath, rootDir)) {
		const relative = path.relative(rootDir, filePath);
		return {
			section: sections[0],
			relativeParts: relative
				? splitPath(relative)
				: [path.basename(filePath)],
		};
	}

	const match = externalPaths.find((candidate) =>
		isWithinRoot(filePath, candidate.path)
	);
	if (match) {
		let section = externalSections.get(match.key);
		if (!section) {
			section = createFolderNode(match.key);
			externalSections.set(match.key, section);
			sections.push(section);
		}
		const relative = path.relative(match.path, filePath);
		return {
			section,
			relativeParts: relative
				? splitPath(relative)
				: [path.basename(filePath)],
		};
	}

	const fallbackLabel = `${formatPath(path.dirname(filePath))}/`;
	let fallbackSection = externalSections.get(fallbackLabel);
	if (!fallbackSection) {
		fallbackSection = createFolderNode(fallbackLabel);
		externalSections.set(fallbackLabel, fallbackSection);
		sections.push(fallbackSection);
	}
	return {
		section: fallbackSection,
		relativeParts: [path.basename(filePath)],
	};
}

export function resolveSectionForMissing({
	missing,
	rootDir,
	sections,
	externalSections,
	externalPaths,
	formatPath,
	isWithinRoot,
}: ResolveMissingOptions): { section: ModuleNode; relativeParts: string[] } {
	if (missing.filePath) {
		return resolveSectionForFilePath({
			filePath: missing.filePath,
			rootDir,
			externalSections,
			externalPaths,
			sections,
			formatPath,
			isWithinRoot,
		});
	}
	const name = (missing.moduleName || missing.requireId || 'unknown').replace(
		/\\/g,
		'/'
	);
	const parts = name.split(/[/.]/).filter(Boolean);
	if (parts.length === 0) {
		parts.push(name);
	}
	return {
		section: sections[0],
		relativeParts: decorateMissingParts(parts),
	};
}

function splitPath(relativePath: string): string[] {
	const segments = relativePath.split(path.sep).filter(Boolean);
	if (segments.length === 0) {
		return [relativePath];
	}
	return segments.map((segment, index) =>
		index === segments.length - 1 ? segment : `${segment}/`
	);
}
