const fs = require('fs');
const path = require('path');

const COLORS = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m',
};

class AnalysisReporter {
	constructor({ logger } = {}) {
		this.logger = logger || console;
	}

	printConsoleReport(analysis, { verbose = false } = {}) {
		this.printSummary(analysis);

		if (verbose) {
			this.printDependencyTree(analysis);
			this.printTopologicalOrder(analysis);
		}

		this.printWarningsAndErrors(analysis);
	}

	printSummary(analysis) {
		const colorize = this.getBooleanFormatter();
		const humanSize = formatBytes(analysis.metrics.moduleSizeSum);
		const humanBundle = formatBytes(analysis.metrics.estimatedBundleSize);
		const entryLabel = analysis.entryModule?.filePath || 'N/A';
		const missingCount = analysis.metrics.missingCount;
		const renameInfo = analysis.obfuscation.rename || {
			enabled: false,
			min: 5,
			max: 5,
		};

		this.logger.info?.('Analysis Summary');
		this.logger.info?.('-----------------');
		this.logger.info?.(`Entry: ${entryLabel}`);
		this.logger.info?.(`Modules: ${analysis.metrics.moduleCount}`);
		const externalsLine = `Externals: ${analysis.metrics.externalCount}`;
		const missingSuffix = missingCount > 0 ? ` (${missingCount} missing)` : '';
		this.logger.info?.(externalsLine + missingSuffix);
		this.logger.info?.('Obfuscation:');
		this.logger.info?.(
			`  • Variable Rename: ${colorize(renameInfo.enabled)} (min=${renameInfo.min}, max=${renameInfo.max})`
		);
		this.logger.info?.(
			`  • Minify         : ${colorize(analysis.obfuscation.minify)}`
		);
		this.logger.info?.(
			`  • ASCII          : ${colorize(analysis.obfuscation.ascii)}`
		);
		this.logger.info?.(`Module Size Sum: ${humanSize}`);
		this.logger.info?.(`Estimated Bundle Size: ${humanBundle}`);
		this.logger.info?.(
			`Duration: ${analysis.durationMs.toFixed(2)} ms`
		);
	}

	printDependencyTree(analysis) {
		const lines = this.buildDependencyTreeLines(analysis);
		if (lines.length === 0) {
			return;
		}

		this.logger.info?.('\nDependency Tree');
		this.logger.info?.('---------------');
		for (const line of lines) {
			this.logger.info?.(line);
		}
	}

	printTopologicalOrder(analysis) {
		if (!analysis.topologicalOrder || analysis.topologicalOrder.length === 0) {
			return;
		}

		this.logger.info?.('\nTopological Order');
		this.logger.info?.('------------------');
		analysis.topologicalOrder.forEach((moduleName, index) => {
			this.logger.info?.(`${index + 1}. ${moduleName}`);
		});
	}

	printWarningsAndErrors(analysis) {
		if (analysis.warnings.length > 0) {
			this.logger.warn?.('\nWarnings');
			this.logger.warn?.('--------');
			for (const warning of analysis.warnings) {
				this.logger.warn?.(`- ${warning}`);
			}
		}

		if (analysis.missing.length > 0) {
			this.logger.warn?.('\nMissing Modules');
			this.logger.warn?.('-----------------');
			for (const missing of analysis.missing) {
				const severityLabel = missing.fatal ? 'ERROR' : 'WARN';
				const prefix = missing.requiredBy
					? `${missing.requiredBy} -> ${missing.requireId}`
					: missing.requireId;
				this.logger.warn?.(`- [${severityLabel}] ${prefix}: ${missing.message}`);
			}
		}

		if (analysis.errors.length > 0) {
			this.logger.error?.('\nErrors');
			this.logger.error?.('------');
			for (const error of analysis.errors) {
				this.logger.error?.(`- ${error.message}`);
			}
		}
	}

	async writeReport(filePath, analysis, { verbose = false } = {}) {
		const resolvedPath = path.resolve(filePath);
		const ext = path.extname(resolvedPath).toLowerCase();

		if (ext === '.json') {
			const serializable = this.buildSerializablePayload(analysis, verbose);
			await fs.promises.writeFile(
				resolvedPath,
				JSON.stringify(serializable, null, 2),
				'utf-8'
			);
			return resolvedPath;
		}

		const text = this.buildTextReport(analysis, { verbose });
		await fs.promises.writeFile(resolvedPath, text, 'utf-8');
		return resolvedPath;
	}

	buildSerializablePayload(analysis, verbose) {
		const payload = {
			entry: analysis.entryModule?.moduleName || null,
			entryPath: analysis.entryModule?.filePath || null,
			modules: analysis.modules.map((moduleRecord) => ({
				id: moduleRecord.id,
				moduleName: moduleRecord.moduleName,
				filePath: moduleRecord.filePath,
				isExternal: Boolean(moduleRecord.isExternal),
			})),
			externals: analysis.externals.map((moduleRecord) => ({
				id: moduleRecord.id,
				moduleName: moduleRecord.moduleName,
				filePath: moduleRecord.filePath,
			})),
			missing: analysis.missing,
			metrics: analysis.metrics,
			obfuscation: analysis.obfuscation,
			warnings: analysis.warnings,
			errors: analysis.errors.map((err) => err.message),
			success: analysis.success,
			durationMs: analysis.durationMs,
		};

		if (verbose) {
			payload.dependencyGraph = this.buildDependencyGraphSnapshot(analysis);
			payload.topologicalOrder = analysis.topologicalOrder;
		}

		return payload;
	}

	buildTextReport(analysis, { verbose }) {
		const lines = [];
		const colorize = this.getBooleanFormatter({ useColor: false });
		const renameInfo = analysis.obfuscation.rename || {
			enabled: false,
			min: 5,
			max: 5,
		};
		lines.push('Analysis Summary');
		lines.push('-----------------');
		lines.push(`Entry: ${analysis.entryModule?.filePath || 'N/A'}`);
		lines.push(`Modules: ${analysis.metrics.moduleCount}`);
		const externalsLine = `Externals: ${analysis.metrics.externalCount}`;
		const missingSuffix =
			analysis.metrics.missingCount > 0
				? ` (${analysis.metrics.missingCount} missing)`
				: '';
		lines.push(externalsLine + missingSuffix);
		lines.push('Obfuscation:');
		lines.push(
			`  • Variable Rename: ${colorize(renameInfo.enabled)} (min=${renameInfo.min}, max=${renameInfo.max})`
		);
		lines.push(
			`  • Minify         : ${colorize(analysis.obfuscation.minify)}`
		);
		lines.push(
			`  • ASCII          : ${colorize(analysis.obfuscation.ascii)}`
		);
		lines.push(
			`Module Size Sum: ${formatBytes(analysis.metrics.moduleSizeSum)}`
		);
		lines.push(
			`Estimated Bundle Size: ${formatBytes(analysis.metrics.estimatedBundleSize)}`
		);
		lines.push(`Duration: ${analysis.durationMs.toFixed(2)} ms`);

		if (verbose) {
			lines.push('\nDependency Tree');
			lines.push('---------------');
			lines.push(...this.buildDependencyTreeLines(analysis, { useColor: false }));
			lines.push('\nTopological Order');
			lines.push('------------------');
			analysis.topologicalOrder.forEach((moduleName, index) => {
				lines.push(`${index + 1}. ${moduleName}`);
			});
		}

		if (analysis.warnings.length > 0) {
			lines.push('\nWarnings');
			lines.push('--------');
			analysis.warnings.forEach((warning) => lines.push(`- ${warning}`));
		}

		if (analysis.missing.length > 0) {
			lines.push('\nMissing Modules');
			lines.push('-----------------');
			analysis.missing.forEach((missing) => {
				const severityLabel = missing.fatal ? 'ERROR' : 'WARN';
				const prefix = missing.requiredBy
					? `${missing.requiredBy} -> ${missing.requireId}`
					: missing.requireId;
				lines.push(`- [${severityLabel}] ${prefix}: ${missing.message}`);
			});
		}

		if (analysis.errors.length > 0) {
			lines.push('\nErrors');
			lines.push('------');
			analysis.errors.forEach((error) => lines.push(`- ${error.message}`));
		}

		return lines.join('\n');
	}

	buildDependencyGraphSnapshot(analysis) {
		const snapshot = {};
		for (const [moduleId, deps] of analysis.dependencyGraph.entries()) {
			snapshot[moduleId] = deps.map((dep) => ({
				id: dep.id,
				moduleName: dep.moduleName,
				isExternal: dep.isExternal,
				isMissing: dep.isMissing,
				filePath: dep.filePath,
			}));
		}
		return snapshot;
	}

	buildDependencyTreeLines(analysis, { useColor = true } = {}) {
		const entryId = analysis.entryModule?.id;
		if (!entryId || !analysis.dependencyGraph.has(entryId)) {
			return [];
		}

		const visited = new Set();
		const lines = [];

		const traverse = (moduleId, prefix = '', isLast = true) => {
			const moduleRecord = analysis.moduleById.get(moduleId) || {
				moduleName: moduleId,
			};
			const deps = analysis.dependencyGraph.get(moduleId) || [];

			const marker = isLast ? '└─ ' : '├─ ';
			const branch = prefix ? prefix + marker : '';
			const nextPrefix = prefix + (isLast ? '   ' : '│  ');

			let label = moduleRecord.moduleName || moduleId;
			if (moduleRecord.isExternal) {
				label += ' (external)';
			}
			if (moduleRecord.isMissing) {
				label += ' (missing)';
			}

			const coloredLabel = useColor
				? this.decorateLabel(label, moduleRecord)
				: label;

			lines.push(`${branch}${coloredLabel}`);

			if (visited.has(moduleId)) {
				lines.push(`${nextPrefix}↺ (cycle)`);
				return;
			}

			visited.add(moduleId);

			deps.forEach((dep, index) => {
				const last = index === deps.length - 1;
				const depId = dep.id;

				if (dep.isMissing) {
					const missingLabel = `${dep.moduleName || depId} (missing)`;
					const presented = useColor
						? `${COLORS.red}${missingLabel}${COLORS.reset}`
						: missingLabel;
					lines.push(`${nextPrefix}${last ? '└─ ' : '├─ '}${presented}`);
					return;
				}

				traverse(depId, nextPrefix, last);
			});

			visited.delete(moduleId);
		};

		traverse(entryId, '', true);

		return lines;
	}

	decorateLabel(label, moduleRecord) {
		if (moduleRecord.isMissing) {
			return `${COLORS.red}${label}${COLORS.reset}`;
		}
		if (moduleRecord.isExternal) {
			return `${COLORS.yellow}${label}${COLORS.reset}`;
		}
		return `${COLORS.cyan}${label}${COLORS.reset}`;
	}

	getBooleanFormatter({ useColor = true } = {}) {
		return (value) => {
			const text = value ? 'on' : 'off';
			if (!useColor || !supportsColor()) {
				return text;
			}
			return value
				? `${COLORS.green}${text}${COLORS.reset}`
				: `${COLORS.red}${text}${COLORS.reset}`;
		};
	}
}

function formatBytes(size) {
	if (!Number.isFinite(size) || size <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	let idx = 0;
	let current = size;
	while (current >= 1024 && idx < units.length - 1) {
		current /= 1024;
		idx += 1;
	}
	return `${current.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function supportsColor() {
	return process.stdout && process.stdout.isTTY;
}

module.exports = AnalysisReporter;
