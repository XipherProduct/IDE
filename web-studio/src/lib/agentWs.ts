// Browser client for the Code realtime relay.
//
// Flow: mint a single-use ticket over the authenticated REST API, then open the
// WebSocket with ?ticket= (never a long-lived token in the URL). Auto-resyncs
// from the last seen seq on reconnect so a dropped connection never loses turns.

import { codeApi } from './api';

export interface ServerFrame {
	reasoning?: string;
	delta?: string;
	tool_delta?: { index: number; id?: string; name?: string; arguments?: string };
	tool_call?: { id: string; name: string; arguments: string };
	activity?: { callId: string; name: string; status: string; label: string };
	tool_result?: { callId: string; name: string; content: string; edit?: any };
	message?: any;
	session?: any;
	turn?: { index: number; finish_reason?: string; usage?: { input: number; output: number } };
	done?: { sessionId: string };
	error?: { message: string; code?: string };
	catch_up?: { sessionId: string; messages: any[]; running: boolean };
}

type Handler = (f: ServerFrame) => void;

function wsUrl(ticket: string): string {
	const base = location.origin.replace(/^http/, 'ws');
	return `${base}/ide-api/agent/ws?ticket=${encodeURIComponent(ticket)}`;
}

export class AgentSocket {
	private ws: WebSocket | null = null;
	private handlers = new Set<Handler>();
	private sessionId: string;
	private lastSeq = 0;
	private closedByUser = false;
	private reconnectDelay = 800;
	private connecting = false;

	constructor(sessionId: string, sinceSeq = 0) { this.sessionId = sessionId; this.lastSeq = sinceSeq; }

	on(h: Handler): () => void { this.handlers.add(h); return () => this.handlers.delete(h); }
	private emit(f: ServerFrame) { for (const h of this.handlers) { h(f); } }

	async connect(): Promise<void> {
		if (this.connecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) { return; }
		this.connecting = true;
		try {
			const { ticket } = await codeApi.wsTicket();
			const ws = new WebSocket(wsUrl(ticket));
			this.ws = ws;
			ws.onopen = () => {
				this.reconnectDelay = 800;
				this.send({ type: 'subscribe', sessionId: this.sessionId, sinceSeq: this.lastSeq });
			};
			ws.onmessage = ev => {
				let f: ServerFrame;
				try { f = JSON.parse(ev.data); } catch { return; }
				if (f.message && typeof f.message.seq === 'number') { this.lastSeq = Math.max(this.lastSeq, f.message.seq); }
				if (f.catch_up) { for (const m of f.catch_up.messages) { if (m.seq) { this.lastSeq = Math.max(this.lastSeq, m.seq); } } }
				this.emit(f);
			};
			ws.onclose = () => { this.ws = null; this.connecting = false; if (!this.closedByUser) { this.scheduleReconnect(); } };
			ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
		} catch (e) {
			this.connecting = false;
			this.emit({ error: { message: 'connect failed: ' + (e as Error).message, code: 'connect' } });
			if (!this.closedByUser) { this.scheduleReconnect(); }
			return;
		}
		this.connecting = false;
	}

	private scheduleReconnect() {
		const d = Math.min(this.reconnectDelay, 8000);
		this.reconnectDelay = d * 1.7;
		setTimeout(() => { if (!this.closedByUser) { void this.connect(); } }, d);
	}

	private send(obj: any) { if (this.ws && this.ws.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(obj)); } }

	sendMessage(content: string, opts: { model?: string | null; agentMode?: string; permissionMode?: string; reasoningEffort?: string | null } = {}) {
		this.send({ type: 'user_message', sessionId: this.sessionId, content, ...opts });
	}
	cancel() { this.send({ type: 'cancel', sessionId: this.sessionId }); }
	approvePlan(callId: string, approved: boolean, plan?: any) { this.send({ type: 'approve_plan', sessionId: this.sessionId, callId, approved, plan }); }
	allowTool(callId: string, allow: boolean) { this.send({ type: 'tool_permission', sessionId: this.sessionId, callId, allow }); }

	close() { this.closedByUser = true; try { this.ws?.close(); } catch { /* ignore */ } this.ws = null; }
}
