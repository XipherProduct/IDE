/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService, FileChangesEvent } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IAlaskaSkill, IAlaskaSkillService, parseSkillFrontmatter } from '../common/alaskaSkill.js';

export class AlaskaSkillService extends Disposable implements IAlaskaSkillService {
	declare readonly _serviceBrand: undefined;

	private readonly skills = new Map<string, IAlaskaSkill>();
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IPathService private readonly pathService: IPathService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		void this.reload();
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => void this.reload()));
		this._register(this.fileService.onDidFilesChange(e => this.handleFileChange(e)));
	}

	private handleFileChange(e: FileChangesEvent): void {
		const all = [...e.rawAdded, ...e.rawUpdated, ...e.rawDeleted];
		for (const u of all) {
			if (u.path.endsWith('SKILL.md')) {
				void this.reload();
				return;
			}
		}
	}

	list(): readonly IAlaskaSkill[] {
		return Array.from(this.skills.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	get(name: string): IAlaskaSkill | undefined {
		for (const s of this.skills.values()) {
			if (s.name === name) { return s; }
		}
		return undefined;
	}

	findRelevant(userMessage: string, limit = 3): readonly IAlaskaSkill[] {
		if (!userMessage) { return []; }
		const lower = userMessage.toLowerCase();
		const matches: IAlaskaSkill[] = [];
		for (const skill of this.list()) {
			if (skill.triggers.some(t => t && lower.includes(t.toLowerCase()))) {
				matches.push(skill);
				if (matches.length >= limit) { break; }
			}
		}
		return matches;
	}

	async reload(): Promise<void> {
		this.skills.clear();
		for (const folder of this.workspaceService.getWorkspace().folders) {
			const dir = joinPath(folder.uri, '.alaska', 'skills');
			await this.scanDir(dir, 'workspace');
		}
		try {
			const home = await this.pathService.userHome();
			if (home) {
				await this.scanDir(joinPath(home, '.alaska', 'skills'), 'global');
			}
		} catch (err) {
			this.logService.trace('[alaska.skills] resolving home failed', err);
		}
		this._onDidChange.fire();
	}

	private async scanDir(dir: URI, source: 'workspace' | 'global'): Promise<void> {
		try {
			const exists = await this.fileService.exists(dir);
			if (!exists) { return; }
			const stat = await this.fileService.resolve(dir);
			if (!stat.children) { return; }
			for (const child of stat.children) {
				if (!child.isDirectory) { continue; }
				const skillFile = joinPath(child.resource, 'SKILL.md');
				if (!await this.fileService.exists(skillFile)) { continue; }
				try {
					const content = (await this.fileService.readFile(skillFile)).value.toString();
					const parsed = this.parse(content, skillFile, child.name, source);
					if (parsed) {
						this.skills.set(parsed.id, parsed);
					}
				} catch (err) {
					this.logService.trace(`[alaska.skills] failed to parse ${skillFile.toString()}`, err);
				}
			}
		} catch (err) {
			this.logService.trace('[alaska.skills] scan failed', err);
		}
	}

	private parse(content: string, path: URI, dirName: string, source: 'workspace' | 'global'): IAlaskaSkill | undefined {
		const parsed = parseSkillFrontmatter(content);
		if (!parsed) { return undefined; }
		const meta = parsed.meta;
		const name = typeof meta.name === 'string' ? meta.name : dirName;
		const description = typeof meta.description === 'string' ? meta.description : '';
		const triggers = Array.isArray(meta.triggers) ? meta.triggers : [];
		const requiredTools = Array.isArray(meta.required_tools) ? meta.required_tools : [];
		return {
			id: `${source}:${path.fsPath}#${name}`,
			name,
			description,
			triggers,
			requiredTools,
			body: parsed.body,
			source,
			path,
		};
	}
}

export function renderSkillsInjection(active: readonly IAlaskaSkill[]): string {
	if (active.length === 0) { return ''; }
	const out: string[] = ['', '## Available skills for this task', ''];
	for (const s of active) {
		out.push(`### ${s.name}`);
		if (s.description) { out.push(s.description); }
		out.push('');
		out.push(s.body);
		out.push('');
		out.push('---');
		out.push('');
	}
	return out.join('\n');
}

export function renderSkillCatalog(all: readonly IAlaskaSkill[], limit = 20): string {
	if (all.length === 0) { return ''; }
	const out: string[] = ['', 'Available skills (matched on user intent — use /skill <name> to force load):'];
	for (const s of all.slice(0, limit)) {
		out.push(`- ${s.name}: ${s.description}`);
	}
	return out.join('\n');
}
