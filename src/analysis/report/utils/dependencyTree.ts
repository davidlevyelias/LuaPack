import path from 'path';

import type { MissingModuleRecord, ModuleRecord } from '../../types';
import type { ReporterAnalysis } from '../types';
import { collectModuleTags } from './labels';
import { insertModulePath, type ModuleNode } from './dependencyTreeInsert';
import {
	createDependencyTreeContext,
	resolveSectionForFilePath,
	resolveSectionForMissing,
} from './dependencyTreeResolve';

export type { ModuleNode } from './dependencyTreeInsert';

export interface BuildDependencyTreeSectionsOptions {
	formatPath: (targetPath: string | null | undefined) => string;
	isWithinRoot: (targetPath: string, rootDir: string) => boolean;
}

export function buildDependencyTreeSections(
	analysis: ReporterAnalysis,
	{ formatPath, isWithinRoot }: BuildDependencyTreeSectionsOptions
): ModuleNode[] {
	const context = analysis.context || {};
	const treeContext = createDependencyTreeContext(
		context.rootDir ?? null,
		context.externals?.paths || [],
		formatPath
	);

	const entryFilePath = analysis.entryModule?.filePath ?? null;
	const rootDir = treeContext.rootDir;

	const addModuleRecord = (
		moduleRecord: ModuleRecord | null | undefined
	): void => {
		if (!moduleRecord || !moduleRecord.filePath) {
			return;
		}
		const isEntry = Boolean(
			entryFilePath && moduleRecord.filePath === entryFilePath
		);
		const base = resolveSectionForFilePath({
			filePath: moduleRecord.filePath,
			rootDir,
			externalSections: treeContext.externalSections,
			externalPaths: treeContext.externalPaths,
			sections: treeContext.sections,
			formatPath,
			isWithinRoot,
		});
		const { relativeParts, section } = base;

		const tags = collectModuleTags(moduleRecord);
		insertModulePath(section, relativeParts, {
			tags,
			isEntry,
		});
	};

	(analysis.sortedModules || []).forEach(addModuleRecord);

	const missingSeen = new Set<string>();
	for (const missing of analysis.missing) {
		const key = missing.moduleName || missing.requireId;
		if (missingSeen.has(key)) {
			continue;
		}
		missingSeen.add(key);

		const target = resolveSectionForMissing({
			missing,
			rootDir,
			sections: treeContext.sections,
			externalSections: treeContext.externalSections,
			externalPaths: treeContext.externalPaths,
			formatPath,
			isWithinRoot,
		});
		const { relativeParts: parts, section } = target;
		const tags = ['missing'];
		if (missing.isExternal) {
			tags.push('external');
		}
		if (missing.overrideApplied) {
			tags.push('override');
		}
		insertModulePath(section, parts, {
			tags,
			isEntry: false,
		});
	}

	return treeContext.sections.filter(
		(section) => section.children.length > 0
	);
}
