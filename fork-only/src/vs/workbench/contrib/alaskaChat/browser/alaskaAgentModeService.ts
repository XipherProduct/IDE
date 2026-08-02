/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	AlaskaAgentMode,
	IAlaskaAgentModeService,
	IAlaskaAgentModeSnapshot,
	ITaskItem,
	isAlaskaAgentMode,
	parseTasklist,
	renderTasklistAsMarkdown,
} from '../common/alaskaAgentMode.js';

const STORAGE_KEY_MODE_PREFIX = 'alaska.agentMode.';
const STORAGE_KEY_APPROVED_PREFIX = 'alaska.agentMode.approved.';
const STORAGE_KEY_DRAFT_PREFIX = 'alaska.agentMode.draft.';

const DEFAULT_MODE: AlaskaAgentMode = 'chat';

export class AlaskaAgentModeService extends Disposable implements IAlaskaAgentModeService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<IAlaskaAgentModeSnapshot>());
	readonly onDidChange: Event<IAlaskaAgentModeSnapshot> = this._onDidChange.event;

	private readonly modeCache = new Map<string, AlaskaAgentMode>();
	private readonly approvedCache = new Map<string, ITaskItem[]>();
	private readonly draftCache = new Map<string, string>();

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	getMode(sessionId: string): AlaskaAgentMode {
		if (!sessionId) {
			return DEFAULT_MODE;
		}
		const cached = this.modeCache.get(sessionId);
		if (cached) {
			return cached;
		}
		const raw = this.storageService.get(STORAGE_KEY_MODE_PREFIX + sessionId, StorageScope.WORKSPACE, '');
		const resolved: AlaskaAgentMode = isAlaskaAgentMode(raw) ? raw : DEFAULT_MODE;
		this.modeCache.set(sessionId, resolved);
		return resolved;
	}

	setMode(sessionId: string, mode: AlaskaAgentMode): void {
		if (!sessionId || !isAlaskaAgentMode(mode)) {
			return;
		}
		const prev = this.getMode(sessionId);
		if (prev === mode) {
			return;
		}
		this.modeCache.set(sessionId, mode);
		this.storageService.store(STORAGE_KEY_MODE_PREFIX + sessionId, mode, StorageScope.WORKSPACE, StorageTarget.USER);
		this.logService.info(`[alaska.agentMode] session=${sessionId} ${prev} -> ${mode}`);
		this.fireChange(sessionId);
	}

	getApprovedTasklist(sessionId: string): readonly ITaskItem[] | undefined {
		if (!sessionId) {
			return undefined;
		}
		if (this.approvedCache.has(sessionId)) {
			return this.approvedCache.get(sessionId);
		}
		const raw = this.storageService.get(STORAGE_KEY_APPROVED_PREFIX + sessionId, StorageScope.WORKSPACE, '');
		if (!raw) {
			return undefined;
		}
		const parsed = this.safeDeserializeTasks(raw);
		if (!parsed) {
			return undefined;
		}
		this.approvedCache.set(sessionId, parsed);
		return parsed;
	}

	setApprovedTasklist(sessionId: string, tasks: readonly ITaskItem[]): void {
		if (!sessionId) {
			return;
		}
		const copy = tasks.map((t, i) => ({
			id: t.id || `t-${i}-${Date.now()}`,
			index: t.index > 0 ? t.index : i + 1,
			description: t.description,
			completed: !!t.completed,
		}));
		this.approvedCache.set(sessionId, copy);
		this.storageService.store(STORAGE_KEY_APPROVED_PREFIX + sessionId, JSON.stringify(copy), StorageScope.WORKSPACE, StorageTarget.USER);
		this.fireChange(sessionId);
	}

	getDraftTasklist(sessionId: string): string | undefined {
		if (!sessionId) {
			return undefined;
		}
		if (this.draftCache.has(sessionId)) {
			return this.draftCache.get(sessionId);
		}
		const raw = this.storageService.get(STORAGE_KEY_DRAFT_PREFIX + sessionId, StorageScope.WORKSPACE, '');
		if (!raw) {
			return undefined;
		}
		this.draftCache.set(sessionId, raw);
		return raw;
	}

	setDraftTasklist(sessionId: string, markdown: string | undefined): void {
		if (!sessionId) {
			return;
		}
		if (markdown && markdown.trim().length > 0) {
			this.draftCache.set(sessionId, markdown);
			this.storageService.store(STORAGE_KEY_DRAFT_PREFIX + sessionId, markdown, StorageScope.WORKSPACE, StorageTarget.USER);
		} else {
			this.draftCache.delete(sessionId);
			this.storageService.remove(STORAGE_KEY_DRAFT_PREFIX + sessionId, StorageScope.WORKSPACE);
		}
		this.fireChange(sessionId);
	}

	markTaskCompleted(sessionId: string, taskIndex: number): void {
		const list = this.getApprovedTasklist(sessionId);
		if (!list || !list.length) {
			return;
		}
		const target = list.find(t => t.index === taskIndex);
		if (!target || target.completed) {
			return;
		}
		const next: ITaskItem[] = list.map(t => t.index === taskIndex ? { ...t, completed: true } : t);
		this.setApprovedTasklist(sessionId, next);
	}

	clearTasklists(sessionId: string): void {
		if (!sessionId) {
			return;
		}
		this.approvedCache.delete(sessionId);
		this.draftCache.delete(sessionId);
		this.storageService.remove(STORAGE_KEY_APPROVED_PREFIX + sessionId, StorageScope.WORKSPACE);
		this.storageService.remove(STORAGE_KEY_DRAFT_PREFIX + sessionId, StorageScope.WORKSPACE);
		this.fireChange(sessionId);
	}

	approveAndSwitchToAct(sessionId: string): boolean {
		if (!sessionId) {
			return false;
		}
		const draft = this.getDraftTasklist(sessionId);
		if (!draft) {
			return false;
		}
		const tasks = parseTasklist(draft);
		if (tasks.length === 0) {
			return false;
		}
		this.setApprovedTasklist(sessionId, tasks);
		this.setDraftTasklist(sessionId, undefined);
		this.setMode(sessionId, 'act');
		return true;
	}

	backToPlan(sessionId: string): void {
		if (!sessionId) {
			return;
		}
		const approved = this.getApprovedTasklist(sessionId);
		if (approved && approved.length > 0) {
			this.setDraftTasklist(sessionId, renderTasklistAsMarkdown(approved));
		}
		this.setMode(sessionId, 'plan');
	}

	forgetSession(sessionId: string): void {
		if (!sessionId) {
			return;
		}
		this.modeCache.delete(sessionId);
		this.approvedCache.delete(sessionId);
		this.draftCache.delete(sessionId);
		this.storageService.remove(STORAGE_KEY_MODE_PREFIX + sessionId, StorageScope.WORKSPACE);
		this.storageService.remove(STORAGE_KEY_APPROVED_PREFIX + sessionId, StorageScope.WORKSPACE);
		this.storageService.remove(STORAGE_KEY_DRAFT_PREFIX + sessionId, StorageScope.WORKSPACE);
	}

	private fireChange(sessionId: string): void {
		this._onDidChange.fire({
			sessionId,
			mode: this.getMode(sessionId),
			approvedTasklist: this.getApprovedTasklist(sessionId),
			draftTasklistMarkdown: this.getDraftTasklist(sessionId),
		});
	}

	private safeDeserializeTasks(raw: string): ITaskItem[] | undefined {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return undefined;
		}
		if (!Array.isArray(parsed)) {
			return undefined;
		}
		const out: ITaskItem[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') {
				continue;
			}
			const rec = item as Record<string, unknown>;
			const id = typeof rec.id === 'string' ? rec.id : `t-${out.length}-${Date.now()}`;
			const index = typeof rec.index === 'number' && Number.isFinite(rec.index) ? rec.index : out.length + 1;
			const description = typeof rec.description === 'string' ? rec.description : '';
			const completed = rec.completed === true;
			if (!description) {
				continue;
			}
			out.push({ id, index, description, completed });
		}
		return out;
	}
}
