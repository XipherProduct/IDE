/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { TerminalLocation, TerminalExitReason } from '../../../../platform/terminal/common/terminal.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ITerminalService, ITerminalInstance } from '../../../contrib/terminal/browser/terminal.js';
import { ITerminalProfileService } from '../../../contrib/terminal/common/terminal.js';
import { buildInteractiveShellPlan, stripAnsi } from './alaskaTools.js';
import {
	IAlaskaPtySessionService,
	IAlaskaPtySession,
	IAlaskaPtyStartOptions,
	IAlaskaPtyWaitCondition,
	IAlaskaPtyWaitResult,
	IAlaskaPtyReadResult,
	AlaskaPtyStatus,
	ALASKA_PTY_WAIT_CEILING_MS,
} from '../common/alaskaPtySession.js';

/** Rolling output cap per session — matches run_command's soft tail budget. */
const OUTPUT_BUDGET = 256 * 1024;

interface ISessionEntry {
	meta: {
		name: string;
		command?: string;
		status: AlaskaPtyStatus;
		startedAt: number;
		exitedAt?: number;
		exitCode?: number | null;
		shell: string;
	};
	instance: ITerminalInstance;
	buffer: string;
	droppedBytes: number;
	/** Fires on every onData append — drives event-driven waitFor. */
	readonly onData: Emitter<void>;
	readonly disposables: DisposableStore;
}

/**
 * In-process port of grok `ptyctl` over the workbench terminal service. See
 * common/alaskaPtySession.ts. Sessions are keyed by name; each wraps one live
 * `ITerminalInstance` plus a rolling ANSI-stripped output buffer.
 */
export class AlaskaPtySessionService extends Disposable implements IAlaskaPtySessionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly sessions = new Map<string, ISessionEntry>();

	constructor(
		@ITerminalService private readonly terminalService: ITerminalService,
		@ITerminalProfileService private readonly terminalProfileService: ITerminalProfileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async start(options: IAlaskaPtyStartOptions): Promise<IAlaskaPtySession> {
		const existing = this.sessions.get(options.name);
		if (existing) {
			if (!options.force) {
				throw new Error(`A terminal session named "${options.name}" already exists. Pass force to replace it, or pick another name.`);
			}
			await this.stop(options.name);
		}

		const root = options.cwd ?? this.workspaceService.getWorkspace().folders[0]?.uri;
		if (!root) {
			throw new Error('No workspace folder is open to host the terminal session.');
		}
		const os = OS;
		const isRemote = root.scheme === Schemas.alaskacodeRemote;
		let profile;
		try {
			profile = this.terminalProfileService.getDefaultProfile(os) ?? undefined;
		} catch {
			profile = undefined;
		}
		const plan = buildInteractiveShellPlan({
			cwd: root,
			os,
			isRemote,
			profile,
			userShellEnv: os === OperatingSystem.Windows ? undefined : (typeof process !== 'undefined' ? process.env?.SHELL : undefined),
			terminalName: `Xipher IDE · ${options.name}`,
		});

		const instance = await this.terminalService.createTerminal({
			config: plan.config,
			location: TerminalLocation.Panel,
		});

		const disposables = new DisposableStore();
		const onData = disposables.add(new Emitter<void>());
		const entry: ISessionEntry = {
			meta: {
				name: options.name,
				command: options.command,
				status: AlaskaPtyStatus.Running,
				startedAt: Date.now(),
				shell: plan.shellLabel,
			},
			instance,
			buffer: '',
			droppedBytes: 0,
			onData,
			disposables,
		};

		disposables.add(instance.onData(raw => {
			const text = stripAnsi(raw);
			if (!text) {
				return;
			}
			entry.buffer += text;
			if (entry.buffer.length > OUTPUT_BUDGET) {
				const excess = entry.buffer.length - OUTPUT_BUDGET;
				entry.buffer = entry.buffer.slice(excess);
				entry.droppedBytes += excess;
			}
			onData.fire();
		}));
		disposables.add(instance.onExit(event => {
			entry.meta.status = AlaskaPtyStatus.Exited;
			entry.meta.exitedAt = Date.now();
			entry.meta.exitCode = typeof event === 'number' ? event : null;
			onData.fire();
			this._onDidChange.fire();
		}));

		this.sessions.set(options.name, entry);
		try {
			await this.terminalService.revealTerminal(instance, true);
		} catch (err) {
			this.logService.warn('[alaska.pty] revealTerminal failed', err);
		}

		if (options.command) {
			// Submit the initial command as input (interactive shell, no baked -c).
			await instance.sendText(options.command, true);
		}
		this._onDidChange.fire();
		return this.toSession(entry);
	}

	async send(name: string, input: string, execute: boolean): Promise<void> {
		const entry = this.sessions.get(name);
		if (!entry) {
			throw new Error(`No terminal session named "${name}".`);
		}
		if (entry.meta.status !== AlaskaPtyStatus.Running) {
			throw new Error(`Terminal session "${name}" has exited (code ${entry.meta.exitCode ?? 'unknown'}).`);
		}
		await entry.instance.sendText(input, execute);
	}

	read(name: string): IAlaskaPtyReadResult {
		const entry = this.sessions.get(name);
		if (!entry) {
			throw new Error(`No terminal session named "${name}".`);
		}
		return {
			output: entry.buffer,
			status: entry.meta.status,
			exitCode: entry.meta.exitCode,
			droppedBytes: entry.droppedBytes,
		};
	}

	waitFor(name: string, condition: IAlaskaPtyWaitCondition, timeoutMs: number): Promise<IAlaskaPtyWaitResult> {
		const entry = this.sessions.get(name);
		if (!entry) {
			return Promise.reject(new Error(`No terminal session named "${name}".`));
		}
		const cap = Math.min(Math.max(0, timeoutMs), ALASKA_PTY_WAIT_CEILING_MS);

		return new Promise<IAlaskaPtyWaitResult>(resolve => {
			const listeners = new DisposableStore();
			let settled = false;
			let stableTimer: ReturnType<typeof setTimeout> | undefined;

			const finish = (result: IAlaskaPtyWaitResult) => {
				if (settled) {
					return;
				}
				settled = true;
				if (stableTimer !== undefined) {
					clearTimeout(stableTimer);
				}
				listeners.dispose();
				resolve(result);
			};

			const evaluate = () => {
				if (this.conditionMet(entry.buffer, condition)) {
					finish({ matched: true, reason: 'matched', output: entry.buffer });
				}
			};

			const armStable = () => {
				if (condition.kind !== 'stable') {
					return;
				}
				if (stableTimer !== undefined) {
					clearTimeout(stableTimer);
				}
				stableTimer = setTimeout(() => {
					finish({ matched: true, reason: 'matched', output: entry.buffer });
				}, condition.stableMs);
			};

			listeners.add(entry.onData.event(() => {
				if (condition.kind === 'stable') {
					// Any new data resets the quiet window.
					armStable();
				} else {
					evaluate();
				}
			}));

			const timeout = setTimeout(() => {
				finish({ matched: false, reason: 'timeout', output: entry.buffer });
			}, cap);
			listeners.add({ dispose: () => clearTimeout(timeout) } satisfies IDisposable);

			// If the process is already gone, resolve immediately.
			if (entry.meta.status === AlaskaPtyStatus.Exited) {
				const met = condition.kind !== 'stable' && this.conditionMet(entry.buffer, condition);
				finish({ matched: met, reason: met ? 'matched' : 'exited', output: entry.buffer });
				return;
			}

			// Evaluate against already-buffered output, then start the clock.
			if (condition.kind === 'stable') {
				armStable();
			} else {
				evaluate();
			}
		});
	}

	async stop(name: string): Promise<void> {
		const entry = this.sessions.get(name);
		if (!entry) {
			return;
		}
		this.sessions.delete(name);
		entry.disposables.dispose();
		try {
			entry.instance.dispose(TerminalExitReason.Extension);
		} catch (err) {
			this.logService.warn('[alaska.pty] dispose failed', err);
		}
		this._onDidChange.fire();
	}

	get(name: string): IAlaskaPtySession | undefined {
		const entry = this.sessions.get(name);
		return entry ? this.toSession(entry) : undefined;
	}

	list(): readonly IAlaskaPtySession[] {
		return [...this.sessions.values()]
			.map(e => this.toSession(e))
			.sort((a, b) => b.startedAt - a.startedAt);
	}

	disposeAll(): void {
		for (const entry of [...this.sessions.values()]) {
			entry.disposables.dispose();
			try {
				entry.instance.dispose(TerminalExitReason.Extension);
			} catch (err) {
				this.logService.warn('[alaska.pty] dispose failed', err);
			}
		}
		this.sessions.clear();
		this._onDidChange.fire();
	}

	private conditionMet(buffer: string, condition: IAlaskaPtyWaitCondition): boolean {
		switch (condition.kind) {
			case 'text':
				return buffer.includes(condition.value);
			case 'gone':
				return !buffer.includes(condition.value);
			case 'regex':
				try {
					return new RegExp(condition.value).test(buffer);
				} catch {
					// Invalid regex never matches; the tool layer validates up front.
					return false;
				}
			case 'stable':
				return false;
		}
	}

	private toSession(entry: ISessionEntry): IAlaskaPtySession {
		return { ...entry.meta };
	}

	override dispose(): void {
		this.disposeAll();
		super.dispose();
	}
}
