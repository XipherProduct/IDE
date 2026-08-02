/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import {
	IMcpCallResult,
	IMcpServerConfig,
	IMcpServerStatus,
	IMcpSnapshot,
	IMcpToolInfo,
} from '../../../../platform/alaskaMcp/common/alaskaMcp.js';
import {
	ALASKA_REMOTE_MCP_CHANNEL,
	IRemoteMcpExitEvent,
	IRemoteMcpLaunchArgs,
	IRemoteMcpLaunchResult,
	IRemoteMcpStdoutEvent,
} from '../../../../platform/alaskaMcp/common/alaskaRemoteMcp.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';

const HANDSHAKE_TIMEOUT_MS = 8_000;
const TOOLS_LIST_TIMEOUT_MS = 6_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;

interface IRemoteSession {
	config: IMcpServerConfig;
	sessionId?: string;
	state: IMcpServerStatus['state'];
	error?: string;
	tools: IMcpToolInfo[];
	pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string; timer?: ReturnType<typeof setTimeout> }>;
	nextRequestId: number;
	lastChangeAt: string;
}

export class AlaskaRemoteMcpManager extends Disposable {

	private readonly _onDidChange = this._register(new Emitter<IMcpSnapshot>());
	readonly onDidChange: Event<IMcpSnapshot> = this._onDidChange.event;

	private readonly sessions = new Map<string, IRemoteSession>();
	private channel: IChannel | undefined;
	private channelListeners: IDisposable | undefined;
	private bySessionId = new Map<string, string>();

	constructor(
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	getSnapshot(): IMcpSnapshot {
		const servers: IMcpServerStatus[] = [];
		for (const s of this.sessions.values()) {
			servers.push({
				id: s.config.id,
				state: s.state,
				upstream: `${s.config.command} ${s.config.args.join(' ')}`.trim() + ' (remote)',
				toolCount: s.tools.length,
				tools: s.tools,
				error: s.error,
				lastChangeAt: s.lastChangeAt,
			});
		}
		const allTools = servers.flatMap(s => s.tools);
		return { servers, allTools, totalTools: allTools.length };
	}

	async reload(remoteServers: readonly IMcpServerConfig[]): Promise<void> {
		const channel = this.ensureChannel();
		if (!channel) {
			for (const cfg of remoteServers) {
				this.upsertSession(cfg, 'error', 'no remote connection available');
			}
			this._onDidChange.fire(this.getSnapshot());
			return;
		}
		const want = new Set(remoteServers.map(s => s.id));
		for (const [id, s] of Array.from(this.sessions.entries())) {
			if (!want.has(id) && s.sessionId) {
				await channel.call('terminate', { sessionId: s.sessionId }).catch(() => undefined);
				this.bySessionId.delete(s.sessionId);
				this.sessions.delete(id);
			}
		}
		for (const cfg of remoteServers) {
			const existing = this.sessions.get(cfg.id);
			if (existing && existing.state === 'ready' && configsEqual(existing.config, cfg)) { continue; }
			if (existing?.sessionId) {
				await channel.call('terminate', { sessionId: existing.sessionId }).catch(() => undefined);
				this.bySessionId.delete(existing.sessionId);
			}
			await this.startSession(cfg, channel);
		}
		this._onDidChange.fire(this.getSnapshot());
	}

	async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<IMcpCallResult> {
		const parsed = parseQualified(qualifiedName);
		if (!parsed) { return { ok: false, error: `bad qualified tool name: ${qualifiedName}` }; }
		const session = this.sessions.get(parsed.serverId);
		if (!session) { return { ok: false, error: `mcp server not configured: ${parsed.serverId}` }; }
		if (session.state !== 'ready') {
			return { ok: false, error: `mcp server '${parsed.serverId}' not ready (state=${session.state})${session.error ? ': ' + session.error : ''}` };
		}
		try {
			const result = await this.request(session, 'tools/call', { name: parsed.toolName, arguments: args }, TOOL_CALL_TIMEOUT_MS) as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
			const text = Array.isArray(result.content)
				? result.content.filter(c => c && typeof c.text === 'string').map(c => c.text as string).join('\n')
				: typeof result === 'string' ? result : JSON.stringify(result);
			return { ok: !result.isError, isError: !!result.isError, content: text };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async stop(): Promise<void> {
		const channel = this.ensureChannel();
		if (channel) {
			for (const s of this.sessions.values()) {
				if (s.sessionId) {
					await channel.call('terminate', { sessionId: s.sessionId }).catch(() => undefined);
				}
			}
		}
		this.sessions.clear();
		this.bySessionId.clear();
		this._onDidChange.fire(this.getSnapshot());
	}

	private async startSession(cfg: IMcpServerConfig, channel: IChannel): Promise<void> {
		this.upsertSession(cfg, 'starting');
		const session = this.sessions.get(cfg.id);
		if (!session) { return; }
		try {
			const launchArgs: IRemoteMcpLaunchArgs = {
				id: cfg.id,
				command: cfg.command,
				args: cfg.args,
				cwd: cfg.cwd,
				env: cfg.env,
			};
			const result = await channel.call('launchServer', launchArgs) as IRemoteMcpLaunchResult;
			session.sessionId = result.sessionId;
			this.bySessionId.set(result.sessionId, cfg.id);
			await this.request(session, 'initialize', {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: { name: 'alaska-ai-remote', version: '1.0.0' },
			}, HANDSHAKE_TIMEOUT_MS);
			await this.notify(session, 'notifications/initialized', {});
			const toolsResp = await this.request(session, 'tools/list', {}, TOOLS_LIST_TIMEOUT_MS) as { tools?: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }> };
			const tools: IMcpToolInfo[] = [];
			for (const t of toolsResp.tools ?? []) {
				if (!t || typeof t.name !== 'string') { continue; }
				tools.push({
					serverId: cfg.id,
					originalName: t.name,
					qualifiedName: `mcp:${cfg.id}:${t.name}`,
					description: typeof t.description === 'string' ? t.description : '',
					inputSchema: (t.inputSchema && typeof t.inputSchema === 'object') ? t.inputSchema : { type: 'object', properties: {}, additionalProperties: true },
				});
			}
			session.tools = tools;
			session.state = 'ready';
			session.lastChangeAt = new Date().toISOString();
		} catch (err) {
			session.state = 'error';
			session.error = err instanceof Error ? err.message : String(err);
			session.lastChangeAt = new Date().toISOString();
			this.logService.warn(`[alaska.mcp.remote] ${cfg.id} init failed`, err);
		}
	}

	private upsertSession(cfg: IMcpServerConfig, state: IMcpServerStatus['state'], error?: string): void {
		const existing = this.sessions.get(cfg.id);
		if (existing) {
			existing.config = cfg;
			existing.state = state;
			existing.error = error;
			existing.lastChangeAt = new Date().toISOString();
			return;
		}
		this.sessions.set(cfg.id, {
			config: cfg,
			state,
			error,
			tools: [],
			pending: new Map(),
			nextRequestId: 1,
			lastChangeAt: new Date().toISOString(),
		});
	}

	private async request(session: IRemoteSession, method: string, params: unknown, timeoutMs: number): Promise<unknown> {
		const channel = this.ensureChannel();
		if (!channel || !session.sessionId) { throw new Error('remote MCP channel not ready'); }
		const id = session.nextRequestId++;
		const payload = { jsonrpc: '2.0', id, method, params };
		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				session.pending.delete(id);
				reject(new Error(`remote MCP ${method} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			session.pending.set(id, { resolve, reject, method, timer });
			channel.call('sendMessage', { sessionId: session.sessionId, line: JSON.stringify(payload) }).catch(err => {
				clearTimeout(timer);
				session.pending.delete(id);
				reject(err instanceof Error ? err : new Error(String(err)));
			});
		});
	}

	private async notify(session: IRemoteSession, method: string, params: unknown): Promise<void> {
		const channel = this.ensureChannel();
		if (!channel || !session.sessionId) { return; }
		const payload = { jsonrpc: '2.0', method, params };
		await channel.call('sendMessage', { sessionId: session.sessionId, line: JSON.stringify(payload) });
	}

	private ensureChannel(): IChannel | undefined {
		if (this.channel) { return this.channel; }
		const conn = this.remoteAgentService.getConnection();
		if (!conn) { return undefined; }
		this.channel = conn.getChannel(ALASKA_REMOTE_MCP_CHANNEL);
		this.channelListeners?.dispose();
		const stdoutEvent = this.channel.listen<IRemoteMcpStdoutEvent>('onStdoutLine');
		const exitEvent = this.channel.listen<IRemoteMcpExitEvent>('onExit');
		const subs: IDisposable[] = [];
		subs.push(stdoutEvent(e => this.handleStdoutLine(e)));
		subs.push(exitEvent(e => this.handleExit(e)));
		this.channelListeners = toDisposable(() => { for (const d of subs) { d.dispose(); } });
		this._register(this.channelListeners);
		return this.channel;
	}

	private handleStdoutLine(event: IRemoteMcpStdoutEvent): void {
		const cfgId = this.bySessionId.get(event.sessionId);
		if (!cfgId) { return; }
		const session = this.sessions.get(cfgId);
		if (!session) { return; }
		let parsed: unknown;
		try { parsed = JSON.parse(event.line); } catch { return; }
		if (!parsed || typeof parsed !== 'object') { return; }
		const msg = parsed as { id?: unknown; result?: unknown; error?: { code?: number; message?: string } };
		if (typeof msg.id === 'number') {
			const pending = session.pending.get(msg.id);
			if (!pending) { return; }
			session.pending.delete(msg.id);
			if (pending.timer) { clearTimeout(pending.timer); }
			if (msg.error) {
				pending.reject(new Error(`MCP error ${msg.error.code ?? '?'}: ${msg.error.message ?? 'unknown'}`));
			} else {
				pending.resolve(msg.result);
			}
		}
	}

	private handleExit(event: IRemoteMcpExitEvent): void {
		const cfgId = this.bySessionId.get(event.sessionId);
		this.bySessionId.delete(event.sessionId);
		if (!cfgId) { return; }
		const session = this.sessions.get(cfgId);
		if (!session) { return; }
		session.state = 'stopped';
		session.error = event.reason ?? (event.exitCode !== null ? `exited code ${event.exitCode}` : 'exited');
		session.lastChangeAt = new Date().toISOString();
		for (const p of session.pending.values()) {
			if (p.timer) { clearTimeout(p.timer); }
			p.reject(new Error('remote MCP server exited'));
		}
		session.pending.clear();
		this._onDidChange.fire(this.getSnapshot());
	}
}

function configsEqual(a: IMcpServerConfig, b: IMcpServerConfig): boolean {
	if (a.command !== b.command) { return false; }
	if ((a.cwd ?? '') !== (b.cwd ?? '')) { return false; }
	if (a.args.length !== b.args.length) { return false; }
	for (let i = 0; i < a.args.length; i++) { if (a.args[i] !== b.args[i]) { return false; } }
	const aEnv = a.env ?? {};
	const bEnv = b.env ?? {};
	const aKeys = Object.keys(aEnv);
	const bKeys = Object.keys(bEnv);
	if (aKeys.length !== bKeys.length) { return false; }
	for (const k of aKeys) { if (aEnv[k] !== bEnv[k]) { return false; } }
	return true;
}

function parseQualified(name: string): { serverId: string; toolName: string } | undefined {
	if (!name.startsWith('mcp:')) { return undefined; }
	const rest = name.slice('mcp:'.length);
	const idx = rest.indexOf(':');
	if (idx < 0) { return undefined; }
	return { serverId: rest.slice(0, idx), toolName: rest.slice(idx + 1) };
}
