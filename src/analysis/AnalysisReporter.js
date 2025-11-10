const fs = require('fs');
const path = require('path');
const colors = require('ansi-colors');

class AnalysisReporter {
	constructor({ logger } = {}) {
		this.logger = logger || console;
		this.useColor = supportsColor();
	}

	printConsoleReport(analysis, { verbose = false } = {}) {
		this.printSummary(analysis, { verbose });

		if (verbose) {
			this.printDependencyTree(analysis, { ignoreMissing: this.getIgnoreMissing(analysis) });
			this.printTopologicalOrder(analysis, { ignoreMissing: this.getIgnoreMissing(analysis) });
		}

		this.printWarningsAndErrors(analysis, { verbose });
	}

	printSummary(analysis, { verbose = false } = {}) {
		const ignoreMissing = this.getIgnoreMissing(analysis);
		const palette = this.getPalette();
		const rootDir = this.formatPath(analysis.context?.rootDir);
		const entryPath = this.formatPath(analysis.context?.entryPath);
		const moduleCount = analysis.metrics.moduleCount;
		const ignored = analysis.context?.ignoredPatterns || [];
		const externalsInfo = this.buildExternalSummary(analysis);
		const renameInfo = analysis.obfuscation?.rename || { enabled: false, min: 5, max: 5 };
		const moduleSize = formatBytes(analysis.metrics.moduleSizeSum);
		const bundleSize = formatBytes(
			analysis.metrics.bundleSizeBytes > 0
				? analysis.metrics.bundleSizeBytes
				: analysis.metrics.estimatedBundleSize
		);

		this.logger.info?.(palette.heading('Analysis Summary'));
		this.logger.info?.(palette.divider);
		this.logger.info?.(`${palette.key('Root Dir:')} ${palette.value(rootDir)}`);
		this.logger.info?.(`${palette.key('Entry:')} ${palette.value(entryPath)}`);
		this.logger.info?.(`${palette.key('Modules:')} ${palette.value(String(moduleCount))}`);

		if (ignored.length > 0) {
			this.logger.info?.(`${palette.bullet} ${palette.key('Ignored:')}`);
			ignored.forEach((pattern) => {
				this.logger.info?.(`${palette.subDash} ${palette.value(pattern)}`);
			});
		} else {
			this.logger.info?.(
				`${palette.bullet} ${palette.key('Ignored:')} ${palette.muted('none')}`
			);
		}

		this.logger.info?.(
			`${palette.bullet} ${palette.key('Ignore Missing:')} ${palette.bool(ignoreMissing)}`
		);

		const externalsLabel = palette.externals(externalsInfo.countLabel, {
			ignoreMissing,
			hasMissing: externalsInfo.missingCount > 0,
		});
		this.logger.info?.(
			`${palette.bullet} ${palette.key('Externals:')} ${externalsLabel}`
		);

		// NOTE: Env summary removed from top-level; env path details are shown under
		// the Externals verbose block as 'Env Paths' to avoid duplication.

		if (verbose && externalsInfo.verboseDetails) {
			this.logger.info?.(
				`${palette.subBullet} ${palette.key('Recursive:')} ${palette.bool(
					externalsInfo.verboseDetails.recursive
				)}`
			);

			if (externalsInfo.verboseDetails.paths.length > 0) {
				this.logger.info?.(`${palette.subBullet} ${palette.key('Paths:')}`);
				externalsInfo.verboseDetails.paths.forEach((externalPath) => {
					this.logger.info?.(
						`${palette.subDash} ${palette.value(externalPath)}`
					);
				});
			} else {
				this.logger.info?.(
					`${palette.subBullet} ${palette.key('Paths:')} ${palette.muted('none')}`
				);
			}

			if (externalsInfo.verboseDetails.modules.length > 0) {
				this.logger.info?.(`${palette.subBullet} ${palette.key('Modules:')}`);
				externalsInfo.verboseDetails.modules.forEach((module) => {
					const tagLabel = this.colorModuleLabel(module.name, module.tags, {
						ignoreMissing,
					});
					this.logger.info?.(`${palette.subDash} ${tagLabel}`);
				});
			}

			const envVerbose = externalsInfo.verboseDetails.env;
			if (envVerbose) {
				// Show total path count in the Env Paths heading (moved under Externals)
				const total = Number.isFinite(envVerbose.totalPaths) ? envVerbose.totalPaths : 0;
				this.logger.info?.(
					`${palette.subBullet} ${palette.key('Env Paths:')} ${palette.muted(`(${total} ${
						total === 1 ? 'path' : 'paths'
					})`)}`
				);
				if (!envVerbose.entries || envVerbose.entries.length === 0) {
					this.logger.info?.(`${palette.subDash} ${palette.muted('none')}`);
				} else {
					envVerbose.entries.forEach((entry) => {
						// colorize env name green when it has paths, red when empty
						const hasPaths = Array.isArray(entry.paths) && entry.paths.length > 0;
						const envNameLabel = palette.envName
							? palette.envName(entry.name, hasPaths)
							: palette.value(entry.name);

						if (!entry.paths || entry.paths.length === 0) {
							this.logger.info?.(
								`${palette.subDash} ${envNameLabel} ${palette.muted('(none)')}`
							);
							return;
						}

						this.logger.info?.(`${palette.subDash} ${envNameLabel}`);
						entry.paths.forEach((envPath) => {
							this.logger.info?.(`${palette.subDash}   ${palette.value(envPath)}`);
						});
					});
				}
			}
		}

		this.logger.info?.(palette.key('Obfuscation:'));
		this.logger.info?.(
			`  ${palette.dot} Variable Rename: ${palette.bool(renameInfo.enabled)} ${palette.muted(
				`(min=${renameInfo.min}, max=${renameInfo.max})`
			)}`
		);
		this.logger.info?.(
			`  ${palette.dot} Minify         : ${palette.bool(analysis.obfuscation?.minify)}`
		);
		this.logger.info?.(
			`  ${palette.dot} ASCII          : ${palette.bool(analysis.obfuscation?.ascii)}`
		);
		this.logger.info?.(
			`${palette.key('Module Size Sum:')} ${palette.value(moduleSize)}`
		);
		// Only show bundle size when not in analyze-only mode
		if (!analysis.context?.analyzeOnly) {
			this.logger.info?.(
				`${palette.key('Bundle Size:')} ${palette.value(bundleSize)}`
			);
		}
		this.logger.info?.(
			`${palette.key('Duration:')} ${palette.value(
				`${analysis.durationMs.toFixed(2)} ms`
			)}`
		);
	}

	printDependencyTree(analysis, { ignoreMissing }) {
		const sections = this.buildDependencyTreeSections(analysis);
		if (sections.length === 0) {
			return;
		}

		const palette = this.getPalette();
		this.logger.info?.('\n' + palette.heading('Dependency Tree'));
		this.logger.info?.(palette.divider);

		sections.forEach((section, index) => {
			this.buildTreeLines(section, { ignoreMissing }).forEach((line) => {
				this.logger.info?.(line);
			});
			if (index < sections.length - 1) {
				this.logger.info?.('');
			}
		});
	}

	printTopologicalOrder(analysis, { ignoreMissing }) {
		if (!analysis.sortedModules || analysis.sortedModules.length === 0) {
			return;
		}
		const modules = this.buildTopologicalList(analysis);
		const palette = this.getPalette();
		this.logger.info?.('\n' + palette.heading('Topological Order'));
		this.logger.info?.(palette.divider);

		modules.forEach((item, index) => {
			const indexLabel = palette.muted(String(index + 1).padStart(2, '0'));
			const nameLabel = this.colorModuleLabel(item.name, item.tags, {
				ignoreMissing,
				isEntry: item.isEntry,
				displayTags: false,
			});
			this.logger.info?.(`${indexLabel}. ${nameLabel}`);
		});
	}

	printWarningsAndErrors(analysis, { verbose = false } = {}) {
		const palette = this.getPalette();
		const ignoreMissing = this.getIgnoreMissing(analysis);

		if (analysis.warnings.length > 0) {
			this.logger.warn?.('\n' + palette.warningHeader('Warnings'));
			this.logger.warn?.(palette.warning('--------'));
			analysis.warnings.forEach((warning) => {
				this.logger.warn?.(`${palette.warning('-')} ${palette.warning(warning)}`);
			});
		}

		if (!verbose && analysis.missing.length > 0) {
			const headingColor = ignoreMissing ? palette.muted : palette.warning;
			this.logger.warn?.('\n' + headingColor('Missing Modules'));
			this.logger.warn?.(headingColor('-----------------'));
			const bullet = ignoreMissing ? palette.muted('-') : palette.error('-');
			analysis.missing.forEach((missing) => {
				const severityLabel = missing.fatal ? 'ERROR' : 'WARN';
				const prefix = missing.requiredBy
					? `${missing.requiredBy} -> ${missing.requireId}`
					: missing.requireId;
				const message = `${prefix}: ${missing.message}`;
				const colorFn = missing.fatal && !ignoreMissing ? palette.error : headingColor;
				this.logger.warn?.(
					`${bullet} ${colorFn(`[${severityLabel}]`)} ${colorFn(message)}`
				);
			});
		}

		if (analysis.errors.length > 0) {
			this.logger.error?.('\n' + palette.errorHeader('Errors'));
			this.logger.error?.(palette.error('------'));
			analysis.errors.forEach((error) => {
				this.logger.error?.(`${palette.error('-')} ${palette.error(error.message)}`);
			});
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
			context: analysis.context,
		};

		if (verbose) {
			payload.dependencyGraph = this.buildDependencyGraphSnapshot(analysis);
			payload.topologicalOrder = analysis.sortedModules.map((moduleRecord) => ({
				moduleName: moduleRecord.moduleName,
				filePath: moduleRecord.filePath,
				isExternal: moduleRecord.isExternal,
			}));
		}

		return payload;
	}

	buildTextReport(analysis, { verbose }) {
		const lines = [];
		const ignoreMissing = this.getIgnoreMissing(analysis);
		const externalsInfo = this.buildExternalSummary(analysis);
		const renameInfo = analysis.obfuscation?.rename || { enabled: false, min: 5, max: 5 };
		lines.push('Analysis Summary');
		lines.push('-----------------');
		lines.push(`Root Dir: ${this.formatPath(analysis.context?.rootDir)}`);
		lines.push(`Entry: ${this.formatPath(analysis.context?.entryPath)}`);
		lines.push(`Modules: ${analysis.metrics.moduleCount}`);
		if (analysis.context?.ignoredPatterns?.length) {
			lines.push('Ignored:');
			analysis.context.ignoredPatterns.forEach((pattern) => lines.push(`  - ${pattern}`));
		} else {
			lines.push('Ignored: none');
		}
		lines.push(`Ignore Missing: ${ignoreMissing ? 'on' : 'off'}`);
	lines.push(`Externals: ${externalsInfo.countLabel}`);
		lines.push('Obfuscation:');
		lines.push(
			`  • Variable Rename: ${renameInfo.enabled ? 'on' : 'off'} (min=${renameInfo.min}, max=${renameInfo.max})`
		);
		lines.push(`  • Minify         : ${analysis.obfuscation?.minify ? 'on' : 'off'}`);
		lines.push(`  • ASCII          : ${analysis.obfuscation?.ascii ? 'on' : 'off'}`);
		lines.push(`Module Size Sum: ${formatBytes(analysis.metrics.moduleSizeSum)}`);
		if (!analysis.context?.analyzeOnly) {
			lines.push(
				`Bundle Size: ${formatBytes(
					analysis.metrics.bundleSizeBytes > 0
						? analysis.metrics.bundleSizeBytes
						: analysis.metrics.estimatedBundleSize
				)}`
			);
		}
		lines.push(`Duration: ${analysis.durationMs.toFixed(2)} ms`);

		if (verbose) {
			lines.push('Env Paths:');
			const envVerbose = externalsInfo.verboseDetails?.env;
			if (!envVerbose || !envVerbose.entries || envVerbose.entries.length === 0) {
				lines.push('  - none');
			} else {
				envVerbose.entries.forEach((entry) => {
					if (!entry.paths || entry.paths.length === 0) {
						lines.push(`  - ${entry.name}: (none)`);
						return;
					}
					lines.push(`  - ${entry.name}:`);
					entry.paths.forEach((envPath) => {
						lines.push(`      - ${envPath}`);
					});
				});
			}

			lines.push('\nDependency Tree');
			lines.push('---------------');
			this.buildDependencyTreeSections(analysis).forEach((section, index, array) => {
				this.buildTreeLines(section, { ignoreMissing, useColor: false }).forEach((line) =>
					lines.push(line)
				);
				if (index < array.length - 1) {
					lines.push('');
				}
			});

			lines.push('\nTopological Order');
			lines.push('------------------');
			this.buildTopologicalList(analysis).forEach((item, index) => {
				lines.push(`${String(index + 1).padStart(2, '0')}. ${item.name}`);
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

	buildDependencyTreeSections(analysis) {
		const sections = [];
		const context = analysis.context || {};
		const rootSection = this.createFolderNode('[Root Dir]/');
		sections.push(rootSection);
		const externalSections = new Map();
		const normalizedRootDir = context.rootDir
			? path.resolve(context.rootDir)
			: null;
		const baseForExternals = normalizedRootDir || process.cwd();
		const externalPaths = (context.externals?.paths || []).map((externalPath) => {
			const absolutePath = path.resolve(baseForExternals, externalPath);
			return {
				path: absolutePath,
				key: `${this.formatPath(absolutePath)}/`,
			};
		});

		const entryFilePath = analysis.entryModule?.filePath;
		const rootDir = normalizedRootDir;

		const addModuleRecord = (moduleRecord) => {
			if (!moduleRecord || !moduleRecord.filePath) {
				return;
			}
			const isEntry = entryFilePath && moduleRecord.filePath === entryFilePath;
			const base = this.resolveSectionForPath({
				filePath: moduleRecord.filePath,
				rootDir,
				externalSections,
				externalPaths,
				sections,
			});
			const relativeParts = base.relativeParts;
			const section = base.section;

			const tags = this.collectModuleTags(moduleRecord);
			this.insertPath(section, relativeParts, {
				tags,
				isEntry,
			});
		};

		(analysis.sortedModules || []).forEach(addModuleRecord);

		const missingSeen = new Set();
		for (const missing of analysis.missing) {
			const key = missing.moduleName || missing.requireId;
			if (missingSeen.has(key)) {
				continue;
			}
			missingSeen.add(key);

			const target = this.resolveMissingSection({
				missing,
				rootDir,
				sections,
				externalSections,
				externalPaths,
			});
			const parts = target.relativeParts;
			const section = target.section;
			const tags = ['missing'];
			if (missing.isExternal) {
				tags.push('external');
			}
			if (missing.overrideApplied) {
				tags.push('override');
			}
			this.insertPath(section, parts, {
				tags,
				isEntry: false,
			});
		}

		return sections.filter((section) => section.children.length > 0);
	}

	buildTopologicalList(analysis) {
		const rootDir = analysis.context?.rootDir;
		return (analysis.sortedModules || []).map((moduleRecord) => ({
			name: this.getDisplayName(moduleRecord, rootDir),
			tags: this.collectModuleTags(moduleRecord),
			isEntry:
				analysis.entryModule?.filePath &&
				moduleRecord.filePath === analysis.entryModule.filePath,
		}));
	}

	collectModuleTags(moduleRecord) {
		const tags = [];
		if (moduleRecord?.isExternal) {
			tags.push('external');
		}
		if (moduleRecord?.overrideApplied) {
			tags.push('override');
		}
		// Only show 'skipped' when analysis is explicitly disabled for non-external modules
		// (external modules that are not being traversed should still appear as 'external').
		if (moduleRecord?.analyzeDependencies === false && !moduleRecord?.isExternal) {
			tags.push('skipped');
		}
		return tags;
	}

	buildTreeLines(node, { ignoreMissing, useColor = true } = {}) {
		const lines = [];

		const traverse = (current, prefix = '', isLast = true, showPointer = false) => {
			const pointer = showPointer ? (isLast ? '└─ ' : '├─ ') : '';
			const label = this.colorModuleLabel(current.name, current.tags || [], {
				ignoreMissing,
				isFolder: current.type === 'folder',
				isEntry: Boolean(current.isEntry),
				displayTags: current.displayTags !== false,
				useColor,
			});
			const prefixText = showPointer ? prefix : '';
			lines.push(`${prefixText}${pointer}${label}`);

			if (!current.children || current.children.length === 0) {
				return;
			}

			const nextPrefix = showPointer
				? `${prefix}${isLast ? '   ' : '│  '}`
				: '';

			current.children.forEach((child, index) => {
				const childIsLast = index === current.children.length - 1;
				traverse(child, nextPrefix, childIsLast, true);
			});
		};

		traverse(node, '', true, false);
		return lines;
	}

	insertPath(section, parts, { tags = [], isEntry = false } = {}) {
		let cursor = section;
		for (let index = 0; index < parts.length; index += 1) {
			const segment = parts[index];
			const isLast = index === parts.length - 1;
			if (isLast) {
				const existing = cursor.children.find(
					(child) => child.name === segment && child.type === 'module'
				);
				if (existing) {
					existing.tags = Array.from(new Set([...existing.tags, ...tags]));
					existing.isEntry = existing.isEntry || isEntry;
				} else {
					cursor.children.push({
						name: segment,
						type: 'module',
						tags: [...tags],
						isEntry,
					});
				}
			} else {
				const folderName = segment.endsWith('/') ? segment : `${segment}/`;
				let childFolder = cursor.children.find(
					(child) => child.name === folderName && child.type === 'folder'
				);
				if (!childFolder) {
					childFolder = this.createFolderNode(folderName);
					cursor.children.push(childFolder);
				}
				cursor = childFolder;
			}
		}
	}

	createFolderNode(name) {
		return {
			name,
			type: 'folder',
			children: [],
			tags: [],
			displayTags: false,
		};
	}

	resolveSectionForPath({ filePath, rootDir, externalSections, externalPaths, sections }) {
		if (rootDir && this.isWithinRoot(filePath, rootDir)) {
			const relative = path.relative(rootDir, filePath);
			return {
				section: sections[0],
				relativeParts: relative
					? this.splitPath(relative, true)
					: [path.basename(filePath)],
			};
		}

		const match = externalPaths.find((candidate) =>
			this.isWithinRoot(filePath, candidate.path)
		);
		if (match) {
			let section = externalSections.get(match.key);
			if (!section) {
				section = this.createFolderNode(match.key);
				externalSections.set(match.key, section);
				sections.push(section);
			}
			const relative = path.relative(match.path, filePath);
			return {
				section,
				relativeParts: relative
					? this.splitPath(relative, true)
					: [path.basename(filePath)],
			};
		}

		const fallbackLabel = `${this.formatPath(path.dirname(filePath))}/`;
		let fallbackSection = externalSections.get(fallbackLabel);
		if (!fallbackSection) {
			fallbackSection = this.createFolderNode(fallbackLabel);
			externalSections.set(fallbackLabel, fallbackSection);
			sections.push(fallbackSection);
		}
		return {
			section: fallbackSection,
			relativeParts: [path.basename(filePath)],
		};
	}

	resolveMissingSection({ missing, rootDir, sections, externalSections, externalPaths }) {
		if (missing.filePath) {
			return this.resolveSectionForPath({
				filePath: missing.filePath,
				rootDir,
				sections,
				externalSections,
				externalPaths,
			});
		}
		const name = (missing.moduleName || missing.requireId || 'unknown').replace(/\\/g, '/');
		const parts = name.split(/[/.]/).filter(Boolean);
		if (parts.length === 0) {
			parts.push(name);
		}
		return {
			section: sections[0],
			relativeParts: this.decorateMissingParts(parts),
		};
	}

	splitPath(relativePath, appendExtension) {
		const segments = relativePath.split(path.sep).filter(Boolean);
		if (segments.length === 0) {
			return [relativePath];
		}
		return segments.map((segment, index) => {
			if (index === segments.length - 1) {
				const finalSegment = appendExtension ? segment : segment.replace(/\\/g, '/');
				return finalSegment;
			}
			return `${segment}/`;
		});
	}

	decorateMissingParts(parts) {
		if (parts.length === 0) {
			return parts;
		}
		const cloned = [...parts];
		for (let index = 0; index < cloned.length - 1; index += 1) {
			cloned[index] = `${cloned[index]}/`;
		}
		return cloned;
	}

	colorModuleLabel(name, tags = [], { ignoreMissing, isFolder = false, isEntry = false, displayTags = true, useColor = this.useColor } = {}) {
		const palette = this.getPalette({ useColor });
		const suffix = displayTags && tags.length > 0 ? ` (${tags.join(', ')})` : '';
		const label = `${name}${suffix}`;
		if (isEntry) {
			return palette.entry(label);
		}
		if (isFolder) {
			return palette.folder(label);
		}
		if (tags.includes('skipped')) {
			return palette.muted(label);
		}
		const hasMissing = tags.includes('missing');
		const hasExternal = tags.includes('external');
		if (hasMissing && hasExternal) {
			return ignoreMissing ? palette.muted(label) : palette.error(label);
		}
		if (hasMissing) {
			return ignoreMissing ? palette.muted(label) : palette.error(label);
		}
		if (hasExternal) {
			return palette.external(label);
		}
		if (tags.includes('override')) {
			return palette.override(label);
		}
		return palette.module(label);
	}

	buildExternalSummary(analysis) {
		const externals = analysis.externals || [];
		const missingExternals = analysis.missing.filter((missing) => missing.isExternal);
		const context = analysis.context || {};
		const baseLabel = `${externals.length} ${
			externals.length === 1 ? 'module' : 'modules'
		}`;
		const displayLabel =
			missingExternals.length > 0
				? `${baseLabel} (${missingExternals.length} missing)`
				: baseLabel;
		const envContext = context.externals?.env || {};
		const envNames = Array.isArray(envContext.names)
			? envContext.names
			: [];
		const pathsByEnv = envContext.pathsByEnv && typeof envContext.pathsByEnv === 'object'
			? envContext.pathsByEnv
			: {};
		const resolvedEnvPaths = Array.isArray(envContext.resolvedPaths)
			? envContext.resolvedPaths
			: [];
		const envEntries = envNames.map((envName) => {
			const envPaths = Array.isArray(pathsByEnv[envName]) ? pathsByEnv[envName] : [];
			return {
				name: envName,
				paths: envPaths.map((envPath) => this.formatPath(envPath)),
			};
		});
		const envHasPaths = envEntries.some((entry) => entry.paths.length > 0);
		const envNameLabel = envNames.length > 0 ? envNames.join(', ') : 'env';
		const envLabel = envHasPaths
			? `${envNameLabel} (${resolvedEnvPaths.length} ${
				resolvedEnvPaths.length === 1 ? 'path' : 'paths'
			})`
			: 'none';
		return {
			countLabel: displayLabel,
			missingCount: missingExternals.length,
			envLabel,
			verboseDetails: {
				recursive:
					context.externals && typeof context.externals.recursive === 'boolean'
						? context.externals.recursive
						: true,
				paths: (context.externals?.paths || []).map((externalPath) => this.formatPath(externalPath)),
				modules: [
					...externals.map((module) => ({
						name: module.moduleName,
						tags: module.overrideApplied ? ['external', 'override'] : ['external'],
					})),
					...missingExternals.map((missing) => ({
						name: missing.moduleName || missing.requireId,
						tags: ['external', 'missing'],
					})),
				],
				env: {
					hasPaths: envHasPaths,
					totalPaths: resolvedEnvPaths.length,
					entries: envEntries,
				},
			},
		};
	}

	formatPath(targetPath) {
		if (!targetPath) {
			return 'N/A';
		}
		if (!path.isAbsolute(targetPath)) {
			return targetPath.replace(/\\/g, '/');
		}
		const cwd = process.cwd();
		const relative = path.relative(cwd, targetPath);
		if (!relative || relative === '') {
			return '.';
		}
		return relative.startsWith('..')
			? targetPath.replace(/\\/g, '/')
			: relative.replace(/\\/g, '/');
	}

	getDisplayName(moduleRecord, rootDir) {
		if (!moduleRecord.filePath) {
			return moduleRecord.moduleName;
		}
		if (rootDir && this.isWithinRoot(moduleRecord.filePath, rootDir)) {
			const relative = path.relative(rootDir, moduleRecord.filePath);
			return relative.replace(/\\/g, '/');
		}
		return this.formatPath(moduleRecord.filePath);
	}

	isWithinRoot(targetPath, rootDir) {
		if (!targetPath || !rootDir) {
			return false;
		}
		const relative = path.relative(rootDir, targetPath);
		if (relative === '') {
			return true;
		}
		return !relative.startsWith('..') && !path.isAbsolute(relative);
	}

	getIgnoreMissing(analysis) {
		return Boolean(analysis.context?.ignoreMissing);
	}

	getPalette({ useColor = this.useColor } = {}) {
		const apply = (fn, value) => (useColor ? fn(value) : value);
		const wrap = (fn) => (value) => apply(fn, value);
		return {
			heading: wrap(colors.white.bold),
			divider: apply(colors.gray, '-----------------'),
			key: wrap(colors.cyan),
			value: wrap(colors.white),
			bool: (flag) => (flag ? apply(colors.green, 'on') : apply(colors.red, 'off')),
			bullet: '   •',
			subBullet: '      •',
			subDash: '         -',
			dot: useColor ? colors.gray('•') : '•',
			muted: wrap(colors.gray),
			externals: (label, { ignoreMissing, hasMissing }) => {
				if (!hasMissing) {
					return apply(colors.yellow, label);
				}
				return ignoreMissing
					? apply(colors.gray, label)
					: apply(colors.red, label);
			},
			envName: (name, hasPaths) =>
				hasPaths ? apply(colors.green, name) : apply(colors.red, name),
			module: wrap(colors.blue),
			folder: wrap(colors.white),
			entry: wrap(colors.green),
			external: wrap(colors.yellow),
			error: wrap(colors.red),
			warningHeader: wrap(colors.yellow.bold),
			warning: wrap(colors.yellow),
			errorHeader: wrap(colors.red.bold),
			errorBullet: wrap(colors.red),
			override: wrap(colors.magenta),
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
