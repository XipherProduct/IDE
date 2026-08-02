/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import {
	IAlaskaReminderService,
	IReminderPolicy,
	IReadRecord,
	ITurnReminderInput,
	DEFAULT_REMINDER_POLICY,
	wrapSystemReminder,
} from '../common/alaskaReminder.js';

/**
 * Ported from grok-build's `xai-grok-agent::system_reminder` (policy shape,
 * TodoNudge rate-limiting) + `xai-file-utils::events::tracker` (cross-turn
 * one-shot interrupt flag, read-version bookkeeping). See alaskaReminder.ts.
 */
export class AlaskaReminderService extends Disposable implements IAlaskaReminderService {
	declare readonly _serviceBrand: undefined;

	readonly policy: IReminderPolicy = { ...DEFAULT_REMINDER_POLICY, todoNudge: { ...DEFAULT_REMINDER_POLICY.todoNudge } };

	/** path -> version the agent last saw (mtime/size). */
	private readonly reads = new Map<string, IReadRecord>();

	/** Cross-turn one-shot: the last turn was cancelled with no tool in flight. */
	private interruptArmed = false;

	/** Turn index at which we last emitted a todo nudge (within this prompt). */
	private lastNudgeTurn = -Infinity;
	/** Turn index at which the tasklist was last touched (within this prompt). */
	private lastTasklistTurn = 0;
	/** 0-based index of the current user prompt, for edit attribution. */
	private _promptIndex = -1;

	get promptIndex(): number {
		return this._promptIndex;
	}

	noteRead(record: IReadRecord): void {
		this.reads.set(record.path, record);
	}

	lastRead(path: string): IReadRecord | undefined {
		return this.reads.get(path);
	}

	forgetRead(path: string): void {
		this.reads.delete(path);
	}

	armInterrupt(): void {
		this.interruptArmed = true;
	}

	takeInterruptReminder(): string | undefined {
		if (!this.interruptArmed) {
			return undefined;
		}
		this.interruptArmed = false;
		return wrapSystemReminder(
			'The previous turn was interrupted by the user before it finished. '
			+ 'Do not assume the last action completed. Re-check state if needed, then address the new request below.'
		);
	}

	beginPrompt(): void {
		// New user prompt: reset the per-prompt nudge rate-limit window. Read
		// records deliberately survive — a file read three prompts ago can still
		// go stale under the agent.
		this.lastNudgeTurn = -Infinity;
		this.lastTasklistTurn = 0;
		this._promptIndex++;
	}

	buildTurnReminder(input: ITurnReminderInput): string | undefined {
		if (!this.policy.enabled) {
			return undefined;
		}

		const sections: string[] = [];

		// 1. FILE-CHANGE — highest priority: patching a stale file corrupts it.
		if (this.policy.fileChange && input.staleFiles.length > 0) {
			const list = input.staleFiles.map(p => `- ${p}`).join('\n');
			sections.push(
				'These files changed on disk AFTER you last read them (edited by the user, a formatter, or a build step):\n'
				+ list
				+ '\nYour in-context copy is STALE. You MUST call alaska_read_file on each again before any alaska_patch_file / alaska_write_file — otherwise your `find` text will not match and you risk clobbering the newer content.'
			);
			// We've told the model; clear the records so we don't nag every turn.
			for (const p of input.staleFiles) {
				this.reads.delete(p);
			}
		}

		// 2. TODO-NUDGE — long task, no tasklist maintenance.
		if (this.policy.todoNudge.enabled) {
			if (input.tasklistTouchedThisTurn) {
				this.lastTasklistTurn = input.turnIndex;
			}
			const turnsSince = input.turnIndex - this.lastTasklistTurn;
			const sinceLastNudge = input.turnIndex - this.lastNudgeTurn;
			if (
				!input.hasActiveTasklist
				&& turnsSince >= this.policy.todoNudge.turnsSinceTasklist
				&& sinceLastNudge >= this.policy.todoNudge.turnsBetweenReminders
			) {
				this.lastNudgeTurn = input.turnIndex;
				sections.push(
					'You have been working for several turns without a visible plan. If this task has multiple steps, '
					+ 'maintain a tasklist so the user can follow progress. Keep it updated as you complete each step.'
				);
			}
		}

		if (sections.length === 0) {
			return undefined;
		}
		return wrapSystemReminder(sections.join('\n\n'));
	}
}
