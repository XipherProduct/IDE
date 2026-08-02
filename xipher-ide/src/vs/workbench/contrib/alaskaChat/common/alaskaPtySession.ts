/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Persistent PTY sessions — ported from grok-build's `ptyctl`
 * (crates/codegen/ptyctl-cli). Where `alaska_run_command` is one-shot (spawn a
 * terminal, run to exit, dispose), this keeps a NAMED interactive shell alive
 * so the agent can drive it over many turns: start it, send input, read the
 * screen, wait for a condition, then stop it. That's what ptyctl exists for —
 * REPLs, dev servers, and interactive prompts that a run-to-exit model can't
 * handle.
 *
 * grok exposes this over an HTTP control server keyed by session name; here it
 * is an in-process service over the workbench `ITerminalService`, keyed the
 * same way (unique name per session).
 */

export const enum AlaskaPtyStatus {
	Running = 'running',
	Exited = 'exited',
}

export interface IAlaskaPtySession {
	readonly name: string;
	/** Optional command sent as the first line after the shell launches. */
	readonly command?: string;
	readonly status: AlaskaPtyStatus;
	readonly startedAt: number;
	readonly exitedAt?: number;
	readonly exitCode?: number | null;
	readonly shell: string;
}

export interface IAlaskaPtyStartOptions {
	readonly name: string;
	/** Optional command executed once the interactive shell is ready. */
	readonly command?: string;
	/** Workspace-relative cwd; defaults to workspace root. */
	readonly cwd?: URI;
	/** Replace an existing session of the same name (stops the old one first). */
	readonly force?: boolean;
}

/** A condition for {@link IAlaskaPtySessionService.waitFor}. Mirrors ptyctl `wait`. */
export type IAlaskaPtyWaitCondition =
	| { readonly kind: 'text'; readonly value: string }
	| { readonly kind: 'regex'; readonly value: string }
	| { readonly kind: 'gone'; readonly value: string }
	| { readonly kind: 'stable'; readonly stableMs: number };

export interface IAlaskaPtyWaitResult {
	readonly matched: boolean;
	readonly reason: 'matched' | 'timeout' | 'exited';
	/** Tail of the buffer at resolution, for the agent to inspect. */
	readonly output: string;
}

export interface IAlaskaPtyReadResult {
	readonly output: string;
	readonly status: AlaskaPtyStatus;
	readonly exitCode?: number | null;
	readonly droppedBytes: number;
}

export interface IAlaskaPtySessionService {
	readonly _serviceBrand: undefined;

	/** Fires when a session is created, changes status, or is removed. */
	readonly onDidChange: Event<void>;

	/** Start a named interactive shell. Throws if the name is taken and !force. */
	start(options: IAlaskaPtyStartOptions): Promise<IAlaskaPtySession>;

	/**
	 * Send input to a session. `execute` appends a newline (submit) — mirrors
	 * ptyctl `send --enter`. Throws if the session is unknown or exited.
	 */
	send(name: string, input: string, execute: boolean): Promise<void>;

	/** Read the current rolling output buffer (ANSI stripped). */
	read(name: string): IAlaskaPtyReadResult;

	/**
	 * Event-driven wait for a screen condition, capped at `timeoutMs` (the
	 * service enforces a hard ceiling). Resolves early if the process exits.
	 */
	waitFor(name: string, condition: IAlaskaPtyWaitCondition, timeoutMs: number): Promise<IAlaskaPtyWaitResult>;

	/** Stop and dispose a session. No-op if already gone. */
	stop(name: string): Promise<void>;

	/** Metadata for one session, or undefined if unknown. */
	get(name: string): IAlaskaPtySession | undefined;

	/** All known sessions, most-recently-started first. */
	list(): readonly IAlaskaPtySession[];

	/** Stop and forget every session (new chat thread). */
	disposeAll(): void;
}

export const IAlaskaPtySessionService = createDecorator<IAlaskaPtySessionService>('alaskaPtySessionService');

/** Hard ceiling on {@link IAlaskaPtySessionService.waitFor}, matching ptyctl's 120s server cap. */
export const ALASKA_PTY_WAIT_CEILING_MS = 120_000;
