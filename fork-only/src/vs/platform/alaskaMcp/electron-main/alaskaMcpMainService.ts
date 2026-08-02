/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { ILogService } from '../../log/common/log.js';
import {
	IAlaskaMcpService,
	IMcpCallResult,
	IMcpServerConfig,
	IMcpServerStatus,
	IMcpSnapshot,
	IMcpToolInfo,
} from '../common/alaskaMcp.js';

interface IPendingRequest {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
	method: string;
	timeoutHandle?: Timeout;
}

interface IServerSession {
	config: IMcpServerConfig;
	process: ChildProcessWithoutNullStreams | undefined;
	stdoutBuffer: string;
	pending: Map<number, IPendingRequest>;
	nextId: number;
	tools: IMcpToolInfo[];
	state: IMcpServerStatus['state'];
	error?: string;
	lastChangeAt: string;
	initPromise?: Promise<void>;
}

const HANDSHAKE_TIMEOUT_MS = 8_000;
const TOOLS_LIST_TIMEOUT_MS = 6_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;

export class AlaskaMcpMainService extends Disposable implements IAlaskaMcpService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeStatus = this._register(new Emitter<IMcpSnapshot>());
	readonly onDidChangeStatus: Event<IMcpSnapshot> = this._onDidChangeStatus.event;

	private readonly sessions = new Map<string, IServerSession>();

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async getStatus(): Promise<IMcpSnapshot> {
		return this.snapshot();
	}

	async reload(servers: readonly IMcpServerConfig[]): Promise<IMcpSnapshot> {
		const wantIds = new Set(servers.map(s => s.id));
		for (const [id, session] of Array.from(this.sessions.entries())) {
			if (!wantIds.has(id)) {
				this.killSession(session);
				this.sessions.delete(id);
			}
		}
		for (const cfg of servers) {
			const existing = this.sessions.get(cfg.id);
			if (existing && configsEqual(existing.config, cfg) && existing.state === 'ready') {
				continue;
			}
			if (existing) {
				this.killSession(existing);
			}
			const session: IServerSession = {
				config: cfg,
				process: undefined,
				stdoutBuffer: '',
				pending: new Map(),
				nextId: 1,
				tools: [],
				state: 'idle',
				lastChangeAt: nowIso(),
			};
			this.sessions.set(cfg.id, session);
			session.initPromise = this.spawnAndInitialise(session).catch((err) => {
				this.logService.warn(`[alaska.mcp] start failed for ${cfg.id}`, err);
			});
		}
		await Promise.allSettled(Array.from(this.sessions.values()).map(s => s.initPromise ?? Promise.resolve()));
		this.fireChange();
		return this.snapshot();
	}

	async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<IMcpCallResult> {
		const parsed = parseQualified(qualifiedName);
		if (!parsed) {
			return { ok: false, error: `bad qualified tool name: ${qualifiedName}` };
		}
		const session = this.sessions.get(parsed.serverId);
		if (!session) {
			return { ok: false, error: `mcp server not configured: ${parsed.serverId}` };
		}
		if (session.state !== 'ready') {
			return { ok: false, error: `mcp server '${parsed.serverId}' not ready (state=${session.state})${session.error ? ': ' + session.error : ''}` };
		}
		try {
			const reply = await this.request(session, 'tools/call', { name: parsed.toolName, arguments: args }, TOOL_CALL_TIMEOUT_MS);
			const result = reply as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
			const text = Array.isArray(result.content)
				? result.content.filter(c => c && typeof c.text === 'string').map(c => c.text as string).join('\n')
				: typeof reply === 'string' ? reply : JSON.stringify(reply);
			return { ok: !result.isError, isError: !!result.isError, content: text };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async stop(): Promise<void> {
		for (const session of Array.from(this.sessions.values())) {
			this.killSession(session);
		}
		this.sessions.clear();
		this.fireChange();
	}

	private async spawnAndInitialise(session: IServerSession): Promise<void> {
		this.setState(session, 'starting');
		try {
			const env: NodeJS.ProcessEnv = { ...process.env, ...(session.config.env ?? {}) };
			const child = spawn(session.config.command, session.config.args, {
				cwd: session.config.cwd,
				env,
				stdio: ['pipe', 'pipe', 'pipe'],
				shell: false,
			}) as ChildProcessWithoutNullStreams;
			session.process = child;
			child.stdout.setEncoding('utf8');
			child.stderr.setEncoding('utf8');
			child.stdout.on('data', (chunk: string) => this.onStdout(session, chunk));
			child.stderr.on('data', (chunk: string) => this.logService.trace(`[alaska.mcp] ${session.config.id} stderr: ${chunk.trim()}`));
			child.on('exit', (code, signal) => this.onExit(session, code, signal));
			child.on('error', (err) => this.fail(session, `spawn error: ${err.message}`));

			await this.request(session, 'initialize', {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: { name: 'alaska-ai', version: '1.0.0' },
			}, HANDSHAKE_TIMEOUT_MS);
			this.notify(session, 'notifications/initialized', {});
			const toolsResp = await this.request(session, 'tools/list', {}, TOOLS_LIST_TIMEOUT_MS) as { tools?: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }> };
			const tools: IMcpToolInfo[] = [];
			for (const t of toolsResp.tools ?? []) {
				if (!t || typeof t.name !== 'string') { continue; }
				tools.push({
					serverId: session.config.id,
					originalName: t.name,
					qualifiedName: `mcp:${session.config.id}:${t.name}`,
					description: typeof t.description === 'string' ? t.description : '',
					inputSchema: (t.inputSchema && typeof t.inputSchema === 'object') ? t.inputSchema : { type: 'object', properties: {}, additionalProperties: true },
				});
			}
			session.tools = tools;
			this.setState(session, 'ready');
		} catch (err) {
			this.fail(session, err instanceof Error ? err.message : String(err));
		}
	}

	private onStdout(session: IServerSession, chunk: string): void {
		session.stdoutBuffer += chunk;
		while (true) {
			const idx = session.stdoutBuffer.indexOf('\n');
			if (idx < 0) {
				return;
			}
			const line = session.stdoutBuffer.slice(0, idx).trim();
			session.stdoutBuffer = session.stdoutBuffer.slice(idx + 1);
			if (line.length === 0) {
				continue;
			}
			let payload: unknown;
			try {
				payload = JSON.parse(line);
			} catch (err) {
				this.logService.warn(`[alaska.mcp] ${session.config.id} bad JSON line: ${line.slice(0, 200)}`);
				continue;
			}
			this.handleMessage(session, payload);
		}
	}

	private handleMessage(session: IServerSession, message: unknown): void {
		if (!message || typeof message !== 'object') {
			return;
		}
		const msg = message as { id?: unknown; result?: unknown; error?: { code?: number; message?: string } };
		if (typeof msg.id === 'number') {
			const pending = session.pending.get(msg.id);
			if (!pending) {
				return;
			}
			session.pending.delete(msg.id);
			if (pending.timeoutHandle) {
				clearTimeout(pending.timeoutHandle);
			}
			if (msg.error) {
				pending.reject(new Error(`mcp error ${msg.error.code ?? '?'}: ${msg.error.message ?? 'unknown'}`));
			} else {
				pending.resolve(msg.result);
			}
		}
	}

	private request(session: IServerSession, method: string, params: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
		const id = session.nextId++;
		const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
		return new Promise((resolve, reject) => {
			if (!session.process || session.process.stdin.destroyed) {
				reject(new Error('mcp process is not running'));
				return;
			}
			const timeoutHandle = setTimeout(() => {
				if (session.pending.delete(id)) {
					reject(new Error(`mcp request '${method}' timed out after ${timeoutMs}ms`));
				}
			}, timeoutMs);
			session.pending.set(id, { resolve, reject, method, timeoutHandle });
			try {
				session.process.stdin.write(payload + '\n');
			} catch (err) {
				clearTimeout(timeoutHandle);
				session.pending.delete(id);
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	private notify(session: IServerSession, method: string, params: Record<string, unknown>): void {
		if (!session.process || session.process.stdin.destroyed) {
			return;
		}
		const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
		try {
			session.process.stdin.write(payload + '\n');
		} catch (err) {
			this.logService.warn(`[alaska.mcp] ${session.config.id} notify failed: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	private onExit(session: IServerSession, code: number | null, signal: string | null): void {
		for (const pending of session.pending.values()) {
			if (pending.timeoutHandle) { clearTimeout(pending.timeoutHandle); }
			pending.reject(new Error(`mcp process exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`));
		}
		session.pending.clear();
		session.process = undefined;
		if (session.state !== 'stopped') {
			this.setState(session, 'error', `process exited (code=${code ?? 'null'})`);
		}
	}

	private killSession(session: IServerSession): void {
		const proc = session.process;
		session.process = undefined;
		for (const pending of session.pending.values()) {
			if (pending.timeoutHandle) { clearTimeout(pending.timeoutHandle); }
			pending.reject(new Error('mcp session terminated'));
		}
		session.pending.clear();
		session.tools = [];
		session.state = 'stopped';
		session.lastChangeAt = nowIso();
		if (proc && !proc.killed) {
			try { proc.kill(); } catch { }
		}
	}

	private fail(session: IServerSession, error: string): void {
		this.setState(session, 'error', error);
	}

	private setState(session: IServerSession, state: IServerSession['state'], error?: string): void {
		session.state = state;
		session.error = error;
		session.lastChangeAt = nowIso();
		this.fireChange();
	}

	private fireChange(): void {
		this._onDidChangeStatus.fire(this.snapshot());
	}

	private snapshot(): IMcpSnapshot {
		const servers: IMcpServerStatus[] = [];
		const allTools: IMcpToolInfo[] = [];
		for (const session of this.sessions.values()) {
			const upstream = `${session.config.command} ${session.config.args.join(' ')}`.trim();
			servers.push({
				id: session.config.id,
				state: session.state,
				upstream,
				toolCount: session.tools.length,
				tools: session.tools,
				error: session.error,
				lastChangeAt: session.lastChangeAt,
			});
			for (const tool of session.tools) {
				allTools.push(tool);
			}
		}
		return { servers, allTools, totalTools: allTools.length };
	}

	override dispose(): void {
		void this.stop();
		super.dispose();
	}
}

function configsEqual(a: IMcpServerConfig, b: IMcpServerConfig): boolean {
	if (a.command !== b.command) { return false; }
	if (a.cwd !== b.cwd) { return false; }
	if (a.args.length !== b.args.length) { return false; }
	for (let i = 0; i < a.args.length; i++) {
		if (a.args[i] !== b.args[i]) { return false; }
	}
	const ae = a.env ?? {};
	const be = b.env ?? {};
	const ak = Object.keys(ae);
	const bk = Object.keys(be);
	if (ak.length !== bk.length) { return false; }
	for (const k of ak) {
		if (ae[k] !== be[k]) { return false; }
	}
	return true;
}

function parseQualified(qualified: string): { serverId: string; toolName: string } | undefined {
	if (!qualified.startsWith('mcp:')) {
		return undefined;
	}
	const rest = qualified.slice(4);
	const sep = rest.indexOf(':');
	if (sep < 0) {
		return undefined;
	}
	return { serverId: rest.slice(0, sep), toolName: rest.slice(sep + 1) };
}

function nowIso(): string {
	return new Date().toISOString();
}
