// Web "Code" platform API: REST session management + a hand-rolled RFC6455
// WebSocket relay (zero npm deps), wired onto the existing ide-backend HTTP
// server. This is the browser-facing surface of the server-side agent.
//
// AUTH MODEL (defense in depth):
//   • Identity comes ONLY from the verified transport, never the request body.
//     REST calls carry the site session bearer → resolveWebUser → userId.
//   • The WS is not opened with a long-lived token in the URL. The browser first
//     mints a single-use, 30s, userId-bound TICKET over an authenticated POST,
//     then opens the socket with ?ticket=. The upgrade burns the ticket and
//     checks the Origin against an allowlist.
//   • Every WS frame is re-authorized: getSession(userId, sessionId) returns null
//     unless THIS user owns THAT session, so a socket can only ever touch its
//     owner's sessions.

import crypto from 'node:crypto';
import { resolveWebUser } from './siteClient.mjs';
import * as store from './agentStore.mjs';
import * as bus from './agentBus.mjs';
import { runTurn } from './agentLoop.mjs';
import { MODEL_MAP, DEFAULT_MODEL, buildModelsResponse } from './models.mjs';
import { listFacts, remember, forget } from './memory.mjs';
import * as executors from './executors.mjs';
import { completeUpgrade, abortUpgrade, attachSocket } from './wsframe.mjs';

const WS_PATH = '/agent/ws';
const TICKET_TTL_MS = 30_000;
const MAX_WS_FRAME = 4 * 1024 * 1024; // 4 MiB

// Origins allowed to open the relay. Prod site + dev servers. Extend via
// AGENT_WS_ORIGINS (comma-separated).
const EXTRA_ORIGINS = (process.env.AGENT_WS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const STATIC_ORIGINS = new Set(['https://ide.xipher.pro', ...EXTRA_ORIGINS]);
function isAllowedOrigin(origin) {
	if (!origin) { return false; }
	if (STATIC_ORIGINS.has(origin)) { return true; }
	// dev: localhost / 127.0.0.1 on any port
	return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

// ---- single-use WS tickets --------------------------------------------------

const tickets = new Map(); // ticket -> { userId, expiresAt, spent }
function mintTicket(userId) {
	const ticket = crypto.randomBytes(24).toString('hex');
	tickets.set(ticket, { userId, expiresAt: Date.now() + TICKET_TTL_MS, spent: false });
	return ticket;
}
function burnTicket(ticket) {
	const t = tickets.get(ticket);
	if (!t) { return null; }
	tickets.delete(ticket); // single use — remove regardless
	if (t.spent || Date.now() > t.expiresAt) { return null; }
	return t.userId;
}
// periodic sweep of expired tickets
setInterval(() => {
	const now = Date.now();
	for (const [k, v] of tickets) { if (now > v.expiresAt) { tickets.delete(k); } }
}, 60_000).unref?.();

// ---- REST helpers -----------------------------------------------------------

function sendJson(res, status, obj) {
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
	res.end(JSON.stringify(obj));
}
async function readJson(req, cap = 4 * 1024 * 1024) {
	const chunks = []; let len = 0;
	for await (const c of req) { len += c.length; if (len > cap) { throw new Error('payload too large'); } chunks.push(c); }
	try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
function bearer(req) {
	const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '');
	return m ? m[1] : '';
}
async function requireWebUser(req, res) {
	const who = await resolveWebUser(bearer(req));
	if (!who) { sendJson(res, 401, { message: 'unauthorized' }); return null; }
	return who; // { userId, plan, email, name }
}

function normalizeModel(m) { return MODEL_MAP[m] ? m : (m == null ? null : DEFAULT_MODEL); }

// ---- REST route handler (called from server.mjs router) ---------------------

// Returns true if it handled the request. Paths here are AFTER xpcore strips the
// /ide-api prefix, i.e. /api/agent/...
async function route(req, res, url, method) {
	const path = url.pathname;

	// model catalog, gated + annotated for the web user's live plan
	if (path === '/api/agent/models' && method === 'GET') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, buildModelsResponse(who.plan));
		return true;
	}

	// mint a single-use WS ticket
	if (path === '/api/agent/ws-ticket' && method === 'POST') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { ticket: mintTicket(who.userId), expiresInMs: TICKET_TTL_MS });
		return true;
	}

	// ---- per-user memory (facts injected into chats/sessions) ----
	if (path === '/api/agent/memory' && method === 'GET') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { facts: listFacts(who.userId) });
		return true;
	}
	if (path === '/api/agent/memory' && method === 'POST') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		const b = await readJson(req);
		const fact = remember(who.userId, b.text, 'user');
		if (!fact) { sendJson(res, 400, { message: 'empty fact' }); return true; }
		sendJson(res, 200, { fact });
		return true;
	}
	const mem = /^\/api\/agent\/memory\/([^/]+)$/.exec(path);
	if (mem && method === 'DELETE') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { ok: forget(who.userId, decodeURIComponent(mem[1])) });
		return true;
	}

	// ---- executors (pair / list / revoke) — Phase 2 ----
	if (path === '/api/agent/executors' && method === 'GET') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { executors: executors.listForUser(who.userId) });
		return true;
	}
	if (path === '/api/agent/executors/pair-init' && method === 'POST') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		if (who.plan === 'free') { sendJson(res, 403, { message: 'Подключения доступны с тарифа Trial и выше', code: 'upgrade_required' }); return true; }
		const b = await readJson(req);
		sendJson(res, 200, executors.pairInit(who.userId, b.kind === 'ssh' ? 'ssh' : 'local'));
		return true;
	}
	const exId = /^\/api\/agent\/executors\/([^/]+)$/.exec(path);
	if (exId && method === 'DELETE') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { ok: executors.revoke(who.userId, decodeURIComponent(exId[1])) });
		return true;
	}
	// CLI pairing completion — NOT web-user auth; the pairing code is the credential.
	if (path === '/api/agent/executors/pair-complete' && method === 'POST') {
		const b = await readJson(req);
		const r = executors.pairComplete(b.code, { name: b.name, root: b.root, os: b.os, caps: b.caps });
		sendJson(res, r.ok ? 200 : 400, r);
		return true;
	}

	// list / create sessions
	if (path === '/api/agent/sessions' && method === 'GET') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		sendJson(res, 200, { sessions: store.listSessions(who.userId) });
		return true;
	}
	if (path === '/api/agent/sessions' && method === 'POST') {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		const b = await readJson(req);
		// Code sessions (any real/echo workspace, or agent mode) require Trial+.
		// Free tier keeps the plain chat (agentMode 'chat', no workspace) only.
		const chatOnly = b.agentMode === 'chat' && (!b.workspaceKind || b.workspaceKind === 'none');
		if (!chatOnly && who.plan === 'free') {
			sendJson(res, 403, { message: 'Code доступен с тарифа Trial и выше', code: 'upgrade_required' });
			return true;
		}
		// binding to a real machine / live IDE requires an executor this user owns
		if (b.workspaceKind === 'local' || b.workspaceKind === 'ssh' || b.workspaceKind === 'ide') {
			if (!b.workspaceRef || !executors.getExecutor(who.userId, b.workspaceRef)) {
				sendJson(res, 400, { message: 'unknown or unowned executor' });
				return true;
			}
		}
		const s = store.createSession(who.userId, {
			title: b.title, model: normalizeModel(b.model), agentMode: b.agentMode,
			permissionMode: b.permissionMode, reasoningEffort: b.reasoningEffort,
			workspaceKind: b.workspaceKind, workspaceRef: b.workspaceRef,
		});
		sendJson(res, 200, { session: s });
		return true;
	}

	// /api/agent/sessions/:id[/messages]
	const m = /^\/api\/agent\/sessions\/([^/]+)(\/messages)?$/.exec(path);
	if (m) {
		const who = await requireWebUser(req, res); if (!who) { return true; }
		const sessionId = decodeURIComponent(m[1]);
		const isMessages = !!m[2];
		if (isMessages && method === 'GET') {
			const since = Number(url.searchParams.get('since') || 0) || 0;
			const msgs = store.messagesSince(who.userId, sessionId, since);
			if (msgs == null) { sendJson(res, 404, { message: 'no_session' }); return true; }
			const s = store.getSession(who.userId, sessionId);
			sendJson(res, 200, { session: s && publicSessionView(s), messages: msgs, running: bus.isRunning(sessionId) });
			return true;
		}
		if (!isMessages && method === 'PATCH') {
			const b = await readJson(req);
			const patch = {};
			if (b.title != null) { patch.title = b.title; }
			if (b.model !== undefined) { patch.model = normalizeModel(b.model); }
			if (b.agentMode != null) { patch.agentMode = b.agentMode; }
			if (b.permissionMode != null) { patch.permissionMode = b.permissionMode; }
			if (b.reasoningEffort !== undefined) { patch.reasoningEffort = b.reasoningEffort; }
			const s = store.touchSession(who.userId, sessionId, patch);
			if (!s) { sendJson(res, 404, { message: 'no_session' }); return true; }
			sendJson(res, 200, { session: s });
			return true;
		}
		if (!isMessages && method === 'DELETE') {
			const ok = store.deleteSession(who.userId, sessionId);
			sendJson(res, ok ? 200 : 404, { ok });
			return true;
		}
	}

	return false;
}

function publicSessionView(s) {
	return { id: s.id, title: s.title, model: s.model, agentMode: s.agentMode, permissionMode: s.permissionMode, workspace: s.workspace, seq: s.seq };
}

// ---- WebSocket (browser relay) ---------------------------------------------

function attachWebSocket(server) {
	server.on('upgrade', (req, socket) => {
		let url;
		try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
		// accept with or without the /ide-api prefix (in case xpcore doesn't strip it on upgrade)
		if (url.pathname !== WS_PATH && url.pathname !== '/ide-api' + WS_PATH) { return; }
		const origin = req.headers['origin'] || '';
		if (!isAllowedOrigin(origin)) { return abortUpgrade(socket, 403, 'forbidden origin'); }
		const key = req.headers['sec-websocket-key'];
		if (!key) { return abortUpgrade(socket, 400, 'bad handshake'); }
		const userId = burnTicket(url.searchParams.get('ticket') || '');
		if (!userId) { return abortUpgrade(socket, 401, 'bad ticket'); }
		completeUpgrade(socket, key);
		handleConnection(socket, userId);
	});
}

function handleConnection(socket, userId) {
	const subs = new Map(); // sessionId -> unsubscribe fn
	const conn = attachSocket(socket, {
		maxFrame: MAX_WS_FRAME,
		onText: raw => void onMessage(raw),
		onClose: () => { for (const unsub of subs.values()) { try { unsub(); } catch { /* ignore */ } } subs.clear(); },
	});
	const send = obj => conn.send(obj);

	const ensureSub = sessionId => {
		if (subs.has(sessionId)) { return true; }
		const unsub = bus.subscribe(userId, sessionId, frame => send(frame));
		if (!unsub) { return false; }
		subs.set(sessionId, unsub);
		return true;
	};

	async function onMessage(raw) {
		let msg;
		try { msg = JSON.parse(raw); } catch { return; }
		const sid = msg.sessionId;
		switch (msg.type) {
			case 'subscribe': {
				if (!store.getSession(userId, sid)) { return send({ error: { message: 'no_session', code: 'no_session' } }); }
				if (!ensureSub(sid)) { return send({ error: { message: 'no_session', code: 'no_session' } }); }
				const catchUp = store.messagesSince(userId, sid, Number(msg.sinceSeq) || 0) || [];
				send({ catch_up: { sessionId: sid, messages: catchUp, running: bus.isRunning(sid) } });
				return;
			}
			case 'user_message': {
				const s = store.getSession(userId, sid);
				if (!s) { return send({ error: { message: 'no_session', code: 'no_session' } }); }
				if (bus.isRunning(sid)) { return send({ error: { message: 'a turn is already running', code: 'busy' } }); }
				const patch = {};
				if (msg.model !== undefined) { patch.model = normalizeModel(msg.model); }
				if (msg.agentMode != null) { patch.agentMode = msg.agentMode; }
				if (msg.permissionMode != null) { patch.permissionMode = msg.permissionMode; }
				if (msg.reasoningEffort !== undefined) { patch.reasoningEffort = msg.reasoningEffort; }
				if (Object.keys(patch).length) { store.touchSession(userId, sid, patch); }
				ensureSub(sid);
				const content = String(msg.content || '');
				if (!content.trim()) { return send({ error: { message: 'empty message', code: 'empty' } }); }
				runTurn({ userId, sessionId: sid, content }).catch(e => send({ error: { message: String(e && e.message || e), code: 'turn_error' } }));
				return;
			}
			case 'cancel': { if (store.getSession(userId, sid)) { bus.cancel(sid); } return; }
			case 'approve_plan': { if (store.getSession(userId, sid)) { bus.provideApproval(sid, msg.callId, { approved: !!msg.approved, plan: msg.plan }); } return; }
			case 'tool_permission': { if (store.getSession(userId, sid)) { bus.provideApproval(sid, msg.callId, { approved: !!msg.allow }); } return; }
			default: return;
		}
	}
}

// ---- entry point ------------------------------------------------------------

export function attachAgentApi(server) {
	attachWebSocket(server);
	executors.attachExecutorWs(server); // executor channel on /executor/ws
	return { route };
}
