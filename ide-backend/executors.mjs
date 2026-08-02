// Executor registry, pairing, and tool-call RPC — the bridge between the
// server-side agent loop and a user's real machine (local daemon) or remote host
// (SSH), Phase 2.
//
// SECURITY:
//   • An executor is OWNED by exactly one userId (bound at pairing) and every
//     dispatch re-checks executor.userId === callerUserId.
//   • The daemon authenticates each WS connection with a nonce-bound HMAC over a
//     per-connection challenge (no replay), using a secret minted at pairing and
//     never exposed to any web client.
//   • Pairing is initiated by the authenticated web user (who mints a short code)
//     and completed by the daemon redeeming that code — so a daemon can only bind
//     to the user who paired it.
//   • SSH credentials are sealed at rest with AES-256-GCM under a key kept in a
//     separate file; plaintext is never returned to a client.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { completeUpgrade, abortUpgrade, attachSocket } from './wsframe.mjs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'executors.json');
const SEAL_KEY_PATH = path.join(DATA_DIR, 'executors.sealkey'); // kept separate from the store
const EXECUTOR_WS_PATH = '/executor/ws';
const PAIR_TTL_MS = 10 * 60_000;
const MAX_EXEC_FRAME = 8 * 1024 * 1024; // 8 MiB (tool results can be large)
const DEFAULT_RPC_TIMEOUT = 180_000;

let store = { executors: {} };
let loaded = false;
function load() {
	try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { store = { executors: {} }; }
	store.executors ||= {};
	loaded = true;
}
function ensureLoaded() { if (!loaded) { load(); } }
function save() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const tmp = STORE_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(store));
	fs.renameSync(tmp, STORE_PATH);
}

// ---- sealing key (separate file, 0600) --------------------------------------

let sealKey = null;
function getSealKey() {
	if (sealKey) { return sealKey; }
	try { sealKey = Buffer.from(fs.readFileSync(SEAL_KEY_PATH, 'utf8').trim(), 'hex'); }
	catch {
		sealKey = crypto.randomBytes(32);
		fs.mkdirSync(DATA_DIR, { recursive: true });
		fs.writeFileSync(SEAL_KEY_PATH, sealKey.toString('hex'), { mode: 0o600 });
	}
	return sealKey;
}
// Per-user subkey so one user's sealed secret can't be opened in another's context.
function subKey(userId) { return crypto.createHmac('sha256', getSealKey()).update('user:' + userId).digest(); }

export function sealSecret(userId, plaintext) {
	const iv = crypto.randomBytes(12);
	const c = crypto.createCipheriv('aes-256-gcm', subKey(userId), iv);
	const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()]);
	return { iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), ct: ct.toString('hex') };
}
export function openSecret(userId, sealed) {
	if (!sealed) { return null; }
	try {
		const d = crypto.createDecipheriv('aes-256-gcm', subKey(userId), Buffer.from(sealed.iv, 'hex'));
		d.setAuthTag(Buffer.from(sealed.tag, 'hex'));
		return Buffer.concat([d.update(Buffer.from(sealed.ct, 'hex')), d.final()]).toString('utf8');
	} catch { return null; }
}

// ---- HMAC hello -------------------------------------------------------------

function helloSig(secretHex, executorId, nonce, bodyHash) {
	return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update(`${executorId}\n${nonce}\n${bodyHash}`).digest('hex');
}
function bodyHashOf(fields) { return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex'); }
function tsEqual(a, b) {
	const ba = Buffer.from(String(a || ''), 'utf8'), bb = Buffer.from(String(b || ''), 'utf8');
	return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---- pairing ----------------------------------------------------------------

const pendings = new Map(); // code -> { userId, kind, expiresAt }
function pairCode() {
	const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
	for (let i = 0; i < 8; i++) { s += a[crypto.randomInt(a.length)]; }
	return s.slice(0, 4) + '-' + s.slice(4);
}

export function pairInit(userId, kind = 'local') {
	const code = pairCode();
	pendings.set(code, { userId, kind, expiresAt: Date.now() + PAIR_TTL_MS });
	const pkg = process.env.AGENT_PKG_URL || 'https://ide.xipher.pro/xipher-agent.tgz';
	return {
		code, kind,
		expiresInMs: PAIR_TTL_MS,
		command: `npx -y ${pkg} pair ${code}`,
		runCommand: `npx -y ${pkg}`,
		hint: 'Запустите команду в корне проекта на вашем ПК. Демон подключится к этому аккаунту.',
	};
}

// Redeemed by the daemon (the code is the credential — no web auth here).
export function pairComplete(code, info = {}) {
	ensureLoaded();
	const p = pendings.get(code);
	if (!p) { return { ok: false, error: 'bad_or_used_code' }; }
	if (Date.now() > p.expiresAt) { pendings.delete(code); return { ok: false, error: 'expired' }; }
	pendings.delete(code);
	const id = 'x_' + crypto.randomBytes(9).toString('hex');
	const secret = crypto.randomBytes(32).toString('hex');
	store.executors[id] = {
		id, userId: p.userId, kind: p.kind,
		name: String(info.name || 'daemon').slice(0, 120),
		root: String(info.root || '').slice(0, 500),
		os: String(info.os || '').slice(0, 40),
		caps: Array.isArray(info.caps) ? info.caps.slice(0, 40) : [],
		secret,
		createdAt: Date.now(), lastSeen: 0,
	};
	save();
	return { ok: true, executorId: id, secret, kind: p.kind, wsPath: EXECUTOR_WS_PATH };
}

// Register (or refresh) a desktop IDE as an `ide`-kind executor. Unlike the
// daemon pairing flow, the IDE is ALREADY authenticated (HMAC), so it calls this
// directly with its userId. Passing back a persisted executorId keeps the secret
// stable across IDE launches; omitting it mints a fresh executor.
export function registerExecutor(userId, info = {}) {
	ensureLoaded();
	let e = info.executorId ? store.executors[info.executorId] : null;
	if (e && e.userId !== userId) { e = null; } // never adopt another user's executor
	if (!e) {
		const id = 'x_' + crypto.randomBytes(9).toString('hex');
		e = { id, userId, kind: 'ide', secret: crypto.randomBytes(32).toString('hex'), createdAt: Date.now(), lastSeen: 0 };
		store.executors[id] = e;
	}
	e.name = String(info.name || 'Xipher IDE').slice(0, 120);
	e.root = String(info.root || '').slice(0, 500);
	e.os = String(info.os || '').slice(0, 40);
	e.caps = Array.isArray(info.caps) ? info.caps.slice(0, 40) : ['fs', 'run'];
	save();
	return { ok: true, executorId: e.id, secret: e.secret, kind: 'ide', wsPath: EXECUTOR_WS_PATH };
}

export function listForUser(userId) {
	ensureLoaded();
	return Object.values(store.executors).filter(e => e.userId === userId).map(publicExecutor);
}
function publicExecutor(e) {
	return { id: e.id, kind: e.kind, name: e.name, root: e.root, os: e.os, caps: e.caps, createdAt: e.createdAt, lastSeen: e.lastSeen, status: connections.has(e.id) ? 'online' : 'offline' };
}
// Admin scope: every executor across all users, + online status.
export function listAll() {
	ensureLoaded();
	return Object.values(store.executors).map(e => ({ ...publicExecutor(e), userId: e.userId }));
}
export function adminRevoke(executorId) {
	ensureLoaded();
	if (!store.executors[executorId]) { return false; }
	delete store.executors[executorId];
	save();
	const c = connections.get(executorId);
	if (c) { try { c.close(); } catch { /* ignore */ } connections.delete(executorId); }
	return true;
}
export function onlineCount() { return connections.size; }

export function getExecutor(userId, executorId) {
	ensureLoaded();
	const e = store.executors[executorId];
	return e && e.userId === userId ? e : null;
}
export function revoke(userId, executorId) {
	ensureLoaded();
	const e = store.executors[executorId];
	if (!e || e.userId !== userId) { return false; }
	delete store.executors[executorId];
	save();
	const c = connections.get(executorId);
	if (c) { try { c.close(); } catch { /* ignore */ } connections.delete(executorId); }
	return true;
}

// ---- live connections + RPC -------------------------------------------------

const connections = new Map(); // executorId -> { send, close, pending: Map<callId,{resolve,timer}> }

export function isOnline(executorId) { return connections.has(executorId); }

// Dispatch a tool op to a paired executor. Ownership re-checked here.
export function dispatch(userId, executorId, op, args, { timeoutMs = DEFAULT_RPC_TIMEOUT } = {}) {
	const e = getExecutor(userId, executorId);
	if (!e) { return Promise.resolve({ ok: false, content: 'executor not found or not owned by you' }); }
	const conn = connections.get(executorId);
	if (!conn) { return Promise.resolve({ ok: false, content: `executor "${e.name}" is offline — start the daemon to run this.` }); }
	const callId = 'rpc_' + crypto.randomBytes(8).toString('hex');
	return new Promise(resolve => {
		const timer = setTimeout(() => { conn.pending.delete(callId); resolve({ ok: false, content: `executor timed out after ${Math.round(timeoutMs / 1000)}s` }); }, timeoutMs);
		conn.pending.set(callId, { resolve, timer });
		conn.send({ type: 'rpc', callId, op, args });
	});
}

// ---- executor WebSocket channel ---------------------------------------------

export function attachExecutorWs(server) {
	server.on('upgrade', (req, socket) => {
		let url;
		try { url = new URL(req.url, 'http://x'); } catch { return; }
		// accept with or without the /ide-api prefix (in case xpcore doesn't strip it on upgrade)
		if (url.pathname !== EXECUTOR_WS_PATH && url.pathname !== '/ide-api' + EXECUTOR_WS_PATH) { return; }
		const key = req.headers['sec-websocket-key'];
		if (!key) { return abortUpgrade(socket, 400, 'bad handshake'); }
		completeUpgrade(socket, key);
		handleExecutorConnection(socket);
	});
}

function handleExecutorConnection(socket) {
	ensureLoaded();
	const nonce = crypto.randomBytes(16).toString('hex');
	let executorId = null;
	let authed = false;
	const pending = new Map();

	const conn = attachSocket(socket, {
		maxFrame: MAX_EXEC_FRAME,
		onText: raw => void onMessage(raw),
		onClose: () => {
			if (executorId && connections.get(executorId)?.__self === self) { connections.delete(executorId); }
			for (const { resolve, timer } of pending.values()) { clearTimeout(timer); resolve({ ok: false, content: 'executor disconnected' }); }
			pending.clear();
		},
	});
	const self = {};
	conn.send({ type: 'challenge', nonce });

	function onMessage(raw) {
		let msg;
		try { msg = JSON.parse(raw); } catch { return; }
		if (!authed) {
			if (msg.type !== 'hello') { conn.send({ type: 'error', code: 'expected_hello' }); return; }
			const e = store.executors[msg.executorId];
			if (!e) { conn.send({ type: 'error', code: 'unknown_executor' }); socket.destroy(); return; }
			const bh = bodyHashOf({ kind: msg.kind, os: msg.os, root: msg.root, caps: msg.caps });
			const expected = helloSig(e.secret, e.id, nonce, bh);
			if (!tsEqual(msg.sig, expected)) { conn.send({ type: 'error', code: 'bad_signature' }); socket.destroy(); return; }
			// authenticated — update info + register the live connection
			executorId = e.id; authed = true;
			e.name = String(msg.name || e.name).slice(0, 120);
			e.root = String(msg.root || e.root).slice(0, 500);
			e.os = String(msg.os || e.os).slice(0, 40);
			e.caps = Array.isArray(msg.caps) ? msg.caps.slice(0, 40) : e.caps;
			e.lastSeen = Date.now();
			save();
			const prev = connections.get(executorId);
			if (prev) { try { prev.close(); } catch { /* ignore */ } }
			connections.set(executorId, { send: conn.send, close: conn.close, pending, __self: self });
			conn.send({ type: 'welcome', executorId });
			return;
		}
		// steady state
		if (msg.type === 'reply') {
			const p = pending.get(msg.callId);
			if (p) { clearTimeout(p.timer); pending.delete(msg.callId); p.resolve({ ok: msg.ok !== false, content: msg.content ?? '', edit: msg.edit }); }
			return;
		}
		if (msg.type === 'ping') { conn.send({ type: 'pong' }); return; }
		// (progress frames could be forwarded to the session bus in a later phase)
	}
}
