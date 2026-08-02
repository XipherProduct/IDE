/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Wrap reminder body text in the `<system-reminder>` envelope the agent loop
 * recognises. Mirrors grok's synthetic-message framing: it reads as user-role
 * input but the model treats it as out-of-band runtime context.
 */
export function wrapSystemReminder(body: string): string {
	return `<system-reminder>\n${body}\n</system-reminder>`;
}

/**
 * System-reminder engine — behaviour ported from grok-build's
 * `xai-grok-agent::system_reminder` + `xai-file-utils::events::tracker`.
 *
 * A `<system-reminder>` is a synthetic user-role message injected into the
 * agentic loop between turns. It is NOT real user input — it carries runtime
 * context the model must react to before it may stop or before its next tool
 * call. Three reminder classes are implemented:
 *
 *   1. FILE-CHANGE  — a file the agent read has been externally modified.
 *   2. INTERRUPT    — the previous turn was cancelled before it finished.
 *   3. TODO-NUDGE   — the model has not called todo_write recently.
 */

export interface IReadRecord {
	readonly path: string;
	readonly mtime: number;
	readonly size: number;
}

export interface ITodoNudgePolicy {
	/** Master switch for the todo-nudge class of reminder. */
	enabled: boolean;
	/** Inject a nudge once this many turns have elapsed since the tasklist was touched. */
	turnsSinceTasklist: number;
	/** Minimum turns between successive nudges within one prompt. */
	turnsBetweenReminders: number;
}

export interface IReminderPolicy {
	/** Master switch — disables all reminder injection when false. */
	enabled: boolean;
	/** Emit a re-read warning when a file the agent read has changed on disk. */
	fileChange: boolean;
	todoNudge: ITodoNudgePolicy;
}

export const DEFAULT_REMINDER_POLICY: IReminderPolicy = {
	enabled: true,
	fileChange: true,
	todoNudge: { enabled: true, turnsSinceTasklist: 4, turnsBetweenReminders: 3 },
};

export interface ITurnReminderInput {
	/** 0-based index of the current turn within the active prompt. */
	readonly turnIndex: number;
	/** True if the agent touched the tasklist (alaska_announce_plan) this turn. */
	readonly tasklistTouchedThisTurn: boolean;
	/** True if there is a non-empty approved tasklist for the current session. */
	readonly hasActiveTasklist: boolean;
	/** Workspace-relative paths that changed on disk since the agent last read them. */
	readonly staleFiles: readonly string[];
}

export const IAlaskaReminderService = createDecorator<IAlaskaReminderService>('alaskaReminderService');

export interface IAlaskaReminderService {
	readonly _serviceBrand: undefined;

	/** Live policy — mutated by the settings UI. */
	readonly policy: IReminderPolicy;

	/** Record a file the agent just read (path + stat snapshot). */
	noteRead(record: IReadRecord): void;

	/** Retrieve the last read record for a path, if any. */
	lastRead(path: string): IReadRecord | undefined;

	/** Drop a read record (e.g. after the agent re-reads or we've reminded). */
	forgetRead(path: string): void;

	/** Arm a one-shot interrupt reminder for the next real user prompt. */
	armInterrupt(): void;
	/** Consume the interrupt reminder, if armed. Returns the block or undefined. */
	takeInterruptReminder(): string | undefined;

	/** Reset per-prompt counters at the start of a new user prompt. */
	beginPrompt(): void;

	/**
	 * 0-based index of the current user prompt. Bumped by `beginPrompt`. Used
	 * to attribute agent edits to the prompt that drove them (see hunk tracker).
	 */
	readonly promptIndex: number;

	/**
	 * Build the `<system-reminder>` block to inject before the next turn, or
	 * `undefined` if nothing is pending. Consumes rate-limit state.
	 */
	buildTurnReminder(input: ITurnReminderInput): string | undefined;
}
