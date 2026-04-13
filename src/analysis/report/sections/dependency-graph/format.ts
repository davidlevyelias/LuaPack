import type { Palette } from '../../palette';
import { formatCanonicalModuleId } from '../../utils/canonicalModuleId';
import type { DependencyGraphNode } from './types';

export function formatPackageHeader(
	packageName: string,
	palette: Palette
): string {
	return `${palette.value('[')}${palette.packageToken(
		packageName,
		packageName
	)}${palette.value(']')}`;
}

function formatGraphTags(
	node: DependencyGraphNode,
	palette: Palette,
	missingPolicy: 'error' | 'warn'
): string {
	const tags = [...node.tags].filter((tag) => tag !== 'ref');
	if (tags.length === 0) {
		return '';
	}

	const renderedTags = tags.map((tag) =>
		palette.graphTag(tag, tag, { missingPolicy })
	);
	return ` ${palette.value('(')}${renderedTags.join(
		palette.value(', ')
	)}${palette.value(')')}`;
}

function formatReferenceDefinition(
	node: DependencyGraphNode,
	palette: Palette
): string {
	if (node.isReference || !node.refId) {
		return '';
	}
	return ` ${palette.graphRefDefinition(`[#${node.refId}]`)}`;
}

function formatReferencePointer(
	node: DependencyGraphNode,
	palette: Palette
): string {
	if (!node.isReference || !node.refId) {
		return '';
	}
	return ` ${palette.graphRefPointer(`-> #${node.refId}`)}`;
}

export function formatGraphNodeLabel(
	node: DependencyGraphNode,
	palette: Palette,
	missingPolicy: 'error' | 'warn'
): string {
	return `${formatCanonicalModuleId(node.id, palette)}${formatReferenceDefinition(
		node,
		palette
	)}${formatReferencePointer(
		node,
		palette
	)}${formatGraphTags(
		node,
		palette,
		missingPolicy
	)}`;
}
