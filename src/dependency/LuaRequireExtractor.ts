import luaparse from 'luaparse';

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
	extract(content: string): string[] {
		const ast = luaparse.parse(content) as unknown as LuaAstNode;
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
		const isDirectRequire =
			node.base &&
			node.base.type === 'Identifier' &&
			node.base.name === 'require';

		if (!isDirectRequire) {
			return null;
		}

		let argumentNode: LuaAstNode | null = null;
		if (node.type === 'CallExpression') {
			if (!Array.isArray(node.arguments) || node.arguments.length !== 1) {
				return null;
			}
			argumentNode = node.arguments[0] ?? null;
		} else if (node.type === 'StringCallExpression') {
			argumentNode = node.argument ?? null;
		} else {
			return null;
		}

		if (!argumentNode || argumentNode.type !== 'StringLiteral') {
			return null;
		}

		const moduleId = this.decodeStringLiteral(argumentNode.raw).trim();
		if (!moduleId || !/^[\w\.\/-]+$/.test(moduleId)) {
			return null;
		}

		return moduleId;
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
