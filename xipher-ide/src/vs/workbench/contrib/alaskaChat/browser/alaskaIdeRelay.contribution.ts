/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from './alaskaAuthService.js';
import { IAlaskaActivityService } from './alaskaActivityService.js';
import { AlaskaToolExecutor } from './alaskaTools.js';
import { buildSignedHeaders, bytesToHex, hexToArrayBuffer } from './alaskaApiClient.js';

const STORAGE_KEY = 'alaska.ideExecutor';
const RECONNECT_MIN = 2000;
const RECONNECT_MAX = 30000;

// HMAC-SHA256 hex over a message with a hex key (mirrors the executor HELLO the
// backend expects: no minute-bucket, unlike signChecksum).
async function hmacHex(secretHex: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', hexToArrayBuffer(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const bytes = new TextEncoder().encode(message);
	const buf = new ArrayBuffer(bytes.byteLength); new Uint8Array(buf).set(bytes);
	return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, buf)));
}
async function sha256Hex(message: string): Promise<string> {
	const bytes = new TextEncoder().encode(message);
	const buf = new ArrayBuffer(bytes.byteLength); new Uint8Array(buf).set(bytes);
	return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)));
}

/**
 * Xipher IDE live relay. Registers the running desktop IDE as an `ide`-kind
 * executor with the backend, then serves the web Code platform's tool calls in
 * the workspace that is CURRENTLY OPEN in this IDE — so a session started from
 * the web (ide.xipher.pro/#/code, workspace "IDE") reads and edits the very
 * files the user has open, using the IDE's own tool executor (edits show live in
 * the editor, respect workspace trust, etc.). No inbound port: the IDE dials out
 * over wss to the same endpoint the chat already uses.
 */
export class AlaskaIdeRelayContribution extends Disposable implements IWorkbenchContribution {
	private ws?: WebSocket;
	private creds?: { executorId: string; secret: string };
	private executor?: AlaskaToolExecutor;
	private connecting = false;
	private reconnectDelay = RECONNECT_MIN;
	private reconnectTimer?: ReturnType<typeof setTimeout>;
	private disposed = false;

	constructor(
		@IAlaskaAuthService private readonly authService: IAlaskaAuthService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IWorkspaceTrustManagementService private readonly workspaceTrust: IWorkspaceTrustManagementService,
		@IAlaskaActivityService private readonly activityService: IAlaskaActivityService,
		@ISearchService private readonly searchService: ISearchService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(this.authService.onDidChangeState(() => this.maybeStart()));
		const t = setTimeout(() => this.maybeStart(), 8000);
		this._register({ dispose: () => clearTimeout(t) });
		this._register({ dispose: () => { this.disposed = true; if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); } try { this.ws?.close(); } catch { /* ignore */ } } });
	}

	private get root() { return this.workspaceService.getWorkspace().folders[0]?.uri; }

	private async maybeStart(): Promise<void> {
		if (this.disposed || this.ws || this.connecting) { return; }
		if (!this.root) { return; } // no folder open → nothing to serve
		const userId = this.authService.state.user?.id;
		const creds = await this.authService.getCredentials();
		if (!userId || !creds?.hmacSecret || !creds.clientKey) { return; } // not signed in
		void this.connect(userId, creds);
	}

	private async register(userId: string, creds: any): Promise<{ executorId: string; secret: string } | undefined> {
		const root = this.root!;
		const stored = this.storageService.get(STORAGE_KEY, StorageScope.WORKSPACE);
		let prev: { executorId?: string } = {};
		try { prev = stored ? JSON.parse(stored) : {}; } catch { /* ignore */ }
		const body = JSON.stringify({
			executorId: prev.executorId,
			name: `Xipher IDE · ${basename(root) || 'workspace'}`,
			root: root.fsPath, os: navigator.platform, caps: ['fs', 'run'],
		});
		const headers = await buildSignedHeaders(creds, userId, { method: 'POST', path: '/api/agent/executors/register', body });
		const res = await fetch(`${ALASKA_API_BASE}/api/agent/executors/register`, { method: 'POST', headers, body });
		if (!res.ok) { this.logService.trace('[ide-relay] register failed', res.status); return undefined; }
		const d = await res.json() as { executorId: string; secret: string };
		const rec = { executorId: d.executorId, secret: d.secret };
		this.storageService.store(STORAGE_KEY, JSON.stringify(rec), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		return rec;
	}

	private async connect(userId: string, creds: any): Promise<void> {
		this.connecting = true;
		try {
			const rec = await this.register(userId, creds);
			if (!rec || this.disposed) { this.connecting = false; if (!rec) { this.scheduleReconnect(); } return; }
			this.creds = rec;
			this.executor = new AlaskaToolExecutor(this.fileService, this.textFileService, this.root!, this.workspaceTrust, this.activityService, this.logService, this.searchService, this.authService);
			this.executor.setAgentMode('act');
			this.executor.setPermissionMode('auto');
			const url = ALASKA_API_BASE.replace(/^http/, 'ws') + '/executor/ws';
			const ws = new WebSocket(url);
			this.ws = ws;
			ws.onmessage = ev => void this.onMessage(String(ev.data));
			ws.onclose = () => { this.ws = undefined; this.connecting = false; if (!this.disposed) { this.scheduleReconnect(); } };
			ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
		} catch (e) {
			this.connecting = false;
			this.logService.trace('[ide-relay] connect error', e);
			this.scheduleReconnect();
		}
	}

	private scheduleReconnect(): void {
		if (this.disposed || this.reconnectTimer) { return; }
		const d = Math.min(this.reconnectDelay, RECONNECT_MAX);
		this.reconnectDelay = d * 1.7;
		this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; void this.maybeStart(); }, d);
	}

	private send(obj: unknown): void { if (this.ws && this.ws.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(obj)); } }

	private async onMessage(raw: string): Promise<void> {
		let msg: any;
		try { msg = JSON.parse(raw); } catch { return; }
		if (msg.type === 'challenge') { await this.sendHello(msg.nonce); return; }
		if (msg.type === 'welcome') { this.reconnectDelay = RECONNECT_MIN; this.logService.info('[ide-relay] online — this IDE workspace is now reachable from the web'); return; }
		if (msg.type === 'error') {
			if (msg.code === 'unknown_executor' || msg.code === 'bad_signature') {
				this.storageService.remove(STORAGE_KEY, StorageScope.WORKSPACE); // stale identity → re-register next time
				this.creds = undefined;
			}
			this.logService.trace('[ide-relay] server error', msg.code);
			return;
		}
		if (msg.type === 'rpc') { await this.handleRpc(msg); return; }
	}

	private async sendHello(nonce: string): Promise<void> {
		if (!this.creds || !this.root) { return; }
		const fields = { kind: 'ide', os: navigator.platform, root: this.root.fsPath, caps: ['fs', 'run'] };
		const bodyHash = await sha256Hex(JSON.stringify(fields));
		const sig = await hmacHex(this.creds.secret, `${this.creds.executorId}\n${nonce}\n${bodyHash}`);
		this.send({ type: 'hello', executorId: this.creds.executorId, name: `Xipher IDE · ${basename(this.root) || 'workspace'}`, ...fields, sig });
	}

	private async handleRpc(msg: any): Promise<void> {
		if (!this.executor) { this.send({ type: 'reply', callId: msg.callId, ok: false, content: 'executor not ready' }); return; }
		try {
			const result = await this.executor.execute({ id: msg.callId, name: msg.op, argumentsJson: JSON.stringify(msg.args ?? {}) });
			const edit = result.edit ? { action: result.edit.action, path: result.edit.path, content: result.edit.content, find: result.edit.find, newSnippet: result.edit.newSnippet } : undefined;
			this.send({ type: 'reply', callId: msg.callId, ok: true, content: result.content, edit });
		} catch (e) {
			this.send({ type: 'reply', callId: msg.callId, ok: false, content: String((e as Error)?.message || e) });
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	AlaskaIdeRelayContribution,
	LifecyclePhase.Eventually,
);
