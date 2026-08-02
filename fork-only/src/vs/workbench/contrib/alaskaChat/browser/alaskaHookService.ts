/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IFileService, FileChangesEvent } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IAlaskaHookHostService } from '../../../../platform/alaskaHooks/common/alaskaHooks.js';
import {
	IAlaskaHookActionResult,
	IAlaskaHookConfig,
	IAlaskaHookEntry,
	IAlaskaHookPayload,
	IAlaskaHookService,
	matchesGlob,
} from '../common/alaskaHookService.js';

const HOOK_CONFIG_PATH = ['.alaska', 'hooks.json'];

interface IFolderHookConfig {
	readonly folder: URI;
	readonly configUri: URI;
	readonly config: IAlaskaHookConfig;
}

export class AlaskaHookService extends Disposable implements IAlaskaHookService {
	declare readonly _serviceBrand: undefined;

	private readonly folderConfigs = new Map<string, IFolderHookConfig>();
	private readonly watchers = this._register(new DisposableStore());

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IWorkspaceTrustManagementService private readonly trustService: IWorkspaceTrustManagementService,
		@IAlaskaHookHostService private readonly hookHost: IAlaskaHookHostService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		void this.reload();
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => void this.reload()));
		this._register(this.fileService.onDidFilesChange(e => this.handleFileChange(e)));
	}

	async reload(): Promise<void> {
		this.watchers.clear();
		this.folderConfigs.clear();
		const folders = this.workspaceService.getWorkspace().folders;
		for (const folder of folders) {
			const configUri = joinPath(folder.uri, ...HOOK_CONFIG_PATH);
			try {
				this.watchers.add(this.fileService.watch(configUri));
			} catch (err) {
				this.logService.trace('[alaska.hooks] watch failed', err);
			}
			try {
				const content = (await this.fileService.readFile(configUri)).value.toString();
				const parsed = JSON.parse(content) as unknown;
				const config = this.validateConfig(parsed);
				if (config) {
					this.folderConfigs.set(folder.uri.toString(), { folder: folder.uri, configUri, config });
				}
			} catch {
			}
		}
	}

	async dispatch(payload: IAlaskaHookPayload): Promise<IAlaskaHookActionResult> {
		if (this.folderConfigs.size === 0) { return { action: 'continue' }; }
		if (!this.trustService.isWorkspaceTrusted()) {
			this.logService.trace('[alaska.hooks] workspace untrusted — skipping hooks');
			return { action: 'continue' };
		}
		let current = payload;
		for (const folderCfg of this.orderedFolderConfigs()) {
			const entries = folderCfg.config.hooks[payload.event] ?? [];
			for (const entry of entries) {
				if (!this.matches(entry, current)) { continue; }
				const result = await this.runHook(entry, current, folderCfg.folder);
				if (result.action === 'block') { return result; }
				if (result.action === 'modify' && result.modifiedPayload) {
					current = result.modifiedPayload;
				}
			}
		}
		return { action: 'continue', modifiedPayload: current };
	}

	private orderedFolderConfigs(): IFolderHookConfig[] {
		const out: IFolderHookConfig[] = [];
		for (const folder of this.workspaceService.getWorkspace().folders) {
			const cfg = this.folderConfigs.get(folder.uri.toString());
			if (cfg) {
				out.push(cfg);
			}
		}
		return out;
	}

	private async runHook(entry: IAlaskaHookEntry, payload: IAlaskaHookPayload, folder: URI): Promise<IAlaskaHookActionResult> {
		const cwd = folder.fsPath;
		const timeoutMs = Math.min(entry.timeoutMs ?? 5000, 30_000);
		try {
			const result = await this.hookHost.runHookCommand({
				command: entry.command,
				cwd,
				env: { ALASKA_HOOK_EVENT: payload.event, ALASKA_HOOK_SESSION: payload.sessionId },
				timeoutMs,
				stdin: JSON.stringify(payload),
			});
			if (result.timedOut) {
				if (entry.blocking) {
					return { action: 'block', reason: `Hook '${entry.command}' timed out after ${timeoutMs}ms` };
				}
				this.logService.warn(`[alaska.hooks] non-blocking hook timed out: ${entry.command}`);
				return { action: 'continue' };
			}
			if (result.exitCode !== 0) {
				if (entry.blocking) {
					return { action: 'block', reason: `Hook '${entry.command}' exited ${result.exitCode}: ${result.stderr.slice(0, 500)}` };
				}
				this.logService.warn(`[alaska.hooks] non-blocking hook failed: ${entry.command}`);
				return { action: 'continue' };
			}
			const stdout = result.stdout.trim();
			if (!stdout) { return { action: 'continue' }; }
			try {
				const parsed = JSON.parse(stdout) as IAlaskaHookActionResult;
				if (parsed?.action === 'block' || parsed?.action === 'modify' || parsed?.action === 'continue') {
					return parsed;
				}
			} catch {
				this.logService.trace(`[alaska.hooks] hook ${entry.command} produced non-JSON stdout — treating as continue`);
			}
			return { action: 'continue' };
		} catch (err) {
			if (entry.blocking) {
				return { action: 'block', reason: err instanceof Error ? err.message : String(err) };
			}
			return { action: 'continue' };
		}
	}

	private matches(entry: IAlaskaHookEntry, payload: IAlaskaHookPayload): boolean {
		const matcher = entry.matcher ?? {};
		if (matcher.tool && payload.tool?.name !== matcher.tool) { return false; }
		if (matcher.pathGlob) {
			const path = (payload.tool?.arguments as { path?: string })?.path;
			if (!path || !matchesGlob(path, matcher.pathGlob)) { return false; }
		}
		if (matcher.commandPattern && payload.tool?.name === 'alaska_run_command') {
			const cmd = (payload.tool.arguments as { command?: string })?.command ?? '';
			try {
				if (!new RegExp(matcher.commandPattern).test(cmd)) { return false; }
			} catch {
				return false;
			}
		}
		return true;
	}

	private validateConfig(raw: unknown): IAlaskaHookConfig | undefined {
		if (!raw || typeof raw !== 'object') { return undefined; }
		const obj = raw as Partial<IAlaskaHookConfig>;
		if (typeof obj.version !== 'number' || obj.version !== 1) { return undefined; }
		const hooks = obj.hooks ?? {};
		const out: IAlaskaHookConfig = {
			version: 1,
			hooks: {
				preToolUse: this.sanitizeEntries(hooks.preToolUse),
				postToolUse: this.sanitizeEntries(hooks.postToolUse),
				userPromptSubmit: this.sanitizeEntries(hooks.userPromptSubmit),
				sessionEnd: this.sanitizeEntries(hooks.sessionEnd),
			},
		};
		return out;
	}

	private sanitizeEntries(raw: unknown): IAlaskaHookEntry[] {
		if (!Array.isArray(raw)) { return []; }
		const out: IAlaskaHookEntry[] = [];
		for (const item of raw) {
			if (!item || typeof item !== 'object') { continue; }
			const r = item as Partial<IAlaskaHookEntry>;
			if (typeof r.command !== 'string' || !r.command.trim()) { continue; }
			out.push({
				matcher: (r.matcher && typeof r.matcher === 'object') ? r.matcher : {},
				command: r.command,
				timeoutMs: typeof r.timeoutMs === 'number' ? r.timeoutMs : undefined,
				blocking: !!r.blocking,
			});
		}
		return out;
	}

	private handleFileChange(e: FileChangesEvent): void {
		for (const folder of this.workspaceService.getWorkspace().folders) {
			const configUri = joinPath(folder.uri, ...HOOK_CONFIG_PATH);
			if (e.contains(configUri)) {
				void this.reload();
				return;
			}
		}
	}
}

export function makeHookPayload(
	event: 'preToolUse' | 'postToolUse' | 'userPromptSubmit' | 'sessionEnd',
	sessionId: string,
	workspaceFolder: URI | undefined,
	tool: { name: string; arguments: unknown } | undefined,
	userMessage: string | undefined,
): IAlaskaHookPayload {
	return {
		event,
		sessionId,
		workspaceFolder: workspaceFolder ? workspaceFolder.fsPath : '',
		tool,
		userMessage,
	};
}
