export interface DependencyGraphNode {
	id: string;
	tags: string[];
	refId?: number;
	isReference?: boolean;
	children: DependencyGraphNode[];
}

export interface DependencyGraphPackageSection {
	packageName: string;
	roots: DependencyGraphNode[];
}
