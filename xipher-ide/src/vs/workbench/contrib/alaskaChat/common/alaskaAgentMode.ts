/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type AlaskaAgentMode = 'chat' | 'plan' | 'act';

export const ALASKA_AGENT_MODES: readonly AlaskaAgentMode[] = ['chat', 'plan', 'act'];

export function isAlaskaAgentMode(value: unknown): value is AlaskaAgentMode {
	return value === 'chat' || value === 'plan' || value === 'act';
}

export interface ITaskItem {
	readonly id: string;
	readonly index: number;
	readonly description: string;
	readonly completed: boolean;
}

export interface IAlaskaAgentModeSnapshot {
	readonly sessionId: string;
	readonly mode: AlaskaAgentMode;
	readonly approvedTasklist?: readonly ITaskItem[];
	readonly draftTasklistMarkdown?: string;
}

export const IAlaskaAgentModeService = createDecorator<IAlaskaAgentModeService>('alaskaAgentModeService');

export interface IAlaskaAgentModeService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<IAlaskaAgentModeSnapshot>;

	getMode(sessionId: string): AlaskaAgentMode;
	setMode(sessionId: string, mode: AlaskaAgentMode): void;

	getApprovedTasklist(sessionId: string): readonly ITaskItem[] | undefined;
	setApprovedTasklist(sessionId: string, tasks: readonly ITaskItem[]): void;

	getDraftTasklist(sessionId: string): string | undefined;
	setDraftTasklist(sessionId: string, markdown: string | undefined): void;

	markTaskCompleted(sessionId: string, taskIndex: number): void;
	clearTasklists(sessionId: string): void;

	approveAndSwitchToAct(sessionId: string): boolean;
	backToPlan(sessionId: string): void;

	forgetSession(sessionId: string): void;
}

export function parseTasklist(markdown: string): ITaskItem[] {
	if (!markdown) {
		return [];
	}
	const tasks: ITaskItem[] = [];
	const lines = markdown.split(/\r?\n/);
	const numbered = /^\s*(?:\d+[.)]|[-*])\s+(.+?)\s*$/;
	const seen = new Set<string>();
	const stamp = Date.now();
	for (const line of lines) {
		const m = line.match(numbered);
		if (!m) {
			continue;
		}
		let raw = m[1];
		let completed = false;
		const completionPrefix = /^(?:✓|✔|\[x\]|\[X\])\s+/;
		if (completionPrefix.test(raw)) {
			completed = true;
			raw = raw.replace(completionPrefix, '');
		}
		const cleaned = raw.replace(/^\*\*(.+)\*\*$/, '$1').trim();
		if (!cleaned || cleaned.length > 600) {
			continue;
		}
		const key = cleaned.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		tasks.push({
			id: `t-${tasks.length}-${stamp}`,
			index: tasks.length + 1,
			description: cleaned,
			completed,
		});
		if (tasks.length >= 50) {
			break;
		}
	}
	return tasks;
}

export function renderTasklistAsMarkdown(tasks: readonly ITaskItem[]): string {
	if (!tasks.length) {
		return '';
	}
	return tasks.map(t => `${t.index}. ${t.completed ? '✓ ' : ''}${t.description}`).join('\n');
}

export function parseCompletedSteps(text: string): number[] {
	if (!text) {
		return [];
	}
	const out: number[] = [];
	const re = /^\s*(?:✓|✔)\s+Step\s+(\d+)\b/gim;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const n = parseInt(m[1], 10);
		if (!Number.isFinite(n) || n <= 0 || n > 999) {
			continue;
		}
		if (!out.includes(n)) {
			out.push(n);
		}
	}
	return out;
}
