import luaparse from 'luaparse';

import type { LuaVersion } from '../config/loader/types';

type LuaAstNode = {
	type?: string;
	base?: LuaAstNode;
	name?: string;
	argument?: LuaAstNode;
	arguments?: LuaAstNode[];
	raw?: string;
	[key: string]: unknown;
};

export default class LuaRequireExtractor {
	constructor(private readonly luaVersion: LuaVersion = '5.3') {}

	getLuaVersion(): LuaVersion {
		return this.luaVersion;
	}

	extract(content: string): string[] {
		const ast = luaparse.parse(content, {
			luaVersion: this.luaVersion,
		}) as unknown as LuaAstNode;
		const dependencies: string[] = [];
		this.collectDependenciesFromNode(ast, dependencies);
		return dependencies;
	}

	private collectDependenciesFromNode(
		node: LuaAstNode | null | undefined,
		dependencies: string[]
	): void {
		if (!node || typeof node !== 'object') {
			return;
		}

		const dependency = this.extractRequireDependency(node);
		if (dependency) {
			dependencies.push(dependency);
		}

		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					this.collectDependenciesFromNode(
						item as LuaAstNode,
						dependencies
					);
				}
				continue;
			}

			this.collectDependenciesFromNode(value as LuaAstNode, dependencies);
		}
	}

	private extractRequireDependency(node: LuaAstNode): string | null {
		const argumentNode =
			this.extractDirectRequireArgument(node) ||
			this.extractProtectedRequireArgument(node);

		if (!argumentNode || argumentNode.type !== 'StringLiteral') {
			return null;
		}

		const moduleId = this.decodeStringLiteral(argumentNode.raw).trim();
		if (!moduleId || !/^[\w\.\/-]+$/.test(moduleId)) {
			return null;
		}

		return moduleId;
	}

	private extractDirectRequireArgument(node: LuaAstNode): LuaAstNode | null {
		const isDirectRequire =
			node.base &&
			node.base.type === 'Identifier' &&
			node.base.name === 'require';

		if (!isDirectRequire) {
			return null;
		}

		if (node.type === 'CallExpression') {
			if (!Array.isArray(node.arguments) || node.arguments.length !== 1) {
				return null;
			}
			return node.arguments[0] ?? null;
		}

		if (node.type === 'StringCallExpression') {
			return node.argument ?? null;
		}

		return null;
	}

	private extractProtectedRequireArgument(node: LuaAstNode): LuaAstNode | null {
		if (
			node.type !== 'CallExpression' ||
			!node.base ||
			node.base.type !== 'Identifier' ||
			node.base.name !== 'pcall' ||
			!Array.isArray(node.arguments) ||
			node.arguments.length !== 2
		) {
			return null;
		}

		const [calleeNode, argumentNode] = node.arguments;
		if (
			!calleeNode ||
			calleeNode.type !== 'Identifier' ||
			calleeNode.name !== 'require'
		) {
			return null;
		}

		return argumentNode ?? null;
	}

	private decodeStringLiteral(raw: string | undefined): string {
		if (typeof raw !== 'string' || raw.length === 0) {
			return '';
		}

		if (
			(raw.startsWith('"') && raw.endsWith('"')) ||
			(raw.startsWith("'") && raw.endsWith("'"))
		) {
			return raw.slice(1, -1);
		}

		const longStringMatch = raw.match(/^\[(=*)\[([\s\S]*)\]\1\]$/);
		if (longStringMatch) {
			return longStringMatch[2];
		}

		return raw;
	}
}
