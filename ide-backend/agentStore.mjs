// Server-side session + message store for the Web "Code" platform.
//
// Every record is owned by exactly one userId. All reads/writes go through the
// helpers here so ownership is enforced in ONE place — callers never touch the
// raw store. Persistence is atomic (tmp + rename), matching auth.mjs/plans.mjs.
//
// A per-session monotonic `seq` orders messages so a reconnecting client can
// resync from `sinceSeq` (catch-up) without missing or duplicating turns.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'agent.json');

const MAX_MESSAGES_PER_SESSION = 2000;   // hard cap; prune oldest beyond this
const MAX_SESSIONS_PER_USER = 200;

let store = { sessions: {}, messages: {}, seq: {} };
let loaded = false;

function load() {
	try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
	catch { store = { sessions: {}, messages: {}, seq: {} }; }
	store.sessions ||= {};
	store.messages ||= {};
	store.seq ||= {};
	loaded = true;
}
function ensureLoaded() { if (!loaded) { load(); } }

// Coalesced atomic save: batch rapid writes into one flush on the next tick so a
// busy turn (many tool messages) doesn't fsync per message.
let saveScheduled = false;
function scheduleSave() {
	if (saveScheduled) { return; }
	saveScheduled = true;
	queueMicrotask(() => { saveScheduled = false; flush(); });
}
function flush() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const tmp = STORE_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(store));
	fs.renameSync(tmp, STORE_PATH);
}

function newId(prefix) { return prefix + '_' + crypto.randomBytes(9).toString('hex'); }
function now() { return Date.now(); }

// ---- per-session async lock (serialize a session's turns) -------------------

const locks = new Map(); // sessionId -> Promise chain tail

export function withSessionLock(sessionId, fn) {
	const prev = locks.get(sessionId) || Promise.resolve();
	let release;
	const next = new Promise(r => { release = r; });
	locks.set(sessionId, prev.then(() => next));
	return prev.then(fn).finally(() => {
		release();
		if (locks.get(sessionId) === next) { locks.delete(sessionId); }
	});
}

// ---- sessions ---------------------------------------------------------------

const WORKSPACE_KINDS = new Set(['none', 'echo', 'local', 'ssh', 'ide']);

export function createSession(userId, opts = {}) {
	ensureLoaded();
	const id = newId('s');
	const kind = WORKSPACE_KINDS.has(opts.workspaceKind) ? opts.workspaceKind : 'echo';
	const s = {
		id,
		userId,
		title: (opts.title || 'New session').toString().slice(0, 120),
		createdAt: now(),
		updatedAt: now(),
		model: opts.model || null,
		agentMode: opts.agentMode || 'agent',
		permissionMode: opts.permissionMode || 'auto',
		reasoningEffort: opts.reasoningEffort || null,
		// workspace binding is IMMUTABLE after create
		workspace: { kind, ref: (opts.workspaceRef || '').toString().slice(0, 400) },
		seq: 0,
	};
	store.sessions[id] = s;
	store.messages[id] = [];
	// enforce per-user session cap (drop oldest, with their messages)
	const mine = listSessions(userId);
	if (mine.length > MAX_SESSIONS_PER_USER) {
		for (const old of mine.slice(MAX_SESSIONS_PER_USER)) { deleteSession(userId, old.id); }
	}
	scheduleSave();
	return publicSession(s);
}

// Ownership-checked fetch. Returns the raw session or null (not found OR not
// owned — callers cannot distinguish, which is intentional).
export function getSession(userId, sessionId) {
	ensureLoaded();
	const s = store.sessions[sessionId];
	if (!s || s.userId !== userId) { return null; }
	return s;
}

export function listSessions(userId) {
	ensureLoaded();
	return Object.values(store.sessions)
		.filter(s => s.userId === userId)
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.map(publicSession);
}

export function deleteSession(userId, sessionId) {
	ensureLoaded();
	const s = store.sessions[sessionId];
	if (!s || s.userId !== userId) { return false; }
	delete store.sessions[sessionId];
	delete store.messages[sessionId];
	scheduleSave();
	return true;
}

export function touchSession(userId, sessionId, patch = {}) {
	const s = getSession(userId, sessionId);
	if (!s) { return null; }
	if (patch.title != null) { s.title = String(patch.title).slice(0, 120); }
	if (patch.model != null) { s.model = patch.model; }
	if (patch.agentMode != null) { s.agentMode = patch.agentMode; }
	if (patch.permissionMode != null) { s.permissionMode = patch.permissionMode; }
	if (patch.reasoningEffort !== undefined) { s.reasoningEffort = patch.reasoningEffort; }
	s.updatedAt = now();
	scheduleSave();
	return publicSession(s);
}

function publicSession(s) {
	return {
		id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt,
		model: s.model, agentMode: s.agentMode, permissionMode: s.permissionMode,
		reasoningEffort: s.reasoningEffort, workspace: s.workspace, seq: s.seq,
	};
}

// ---- messages ---------------------------------------------------------------

// Append a message and stamp it with the next per-session seq. Returns the
// stored message (with id + seq). Ownership is enforced via getSession.
export function appendMessage(userId, sessionId, msg) {
	const s = getSession(userId, sessionId);
	if (!s) { return null; }
	const list = store.messages[sessionId] || (store.messages[sessionId] = []);
	const stored = {
		id: msg.id || newId('m'),
		seq: ++s.seq,
		role: msg.role,
		content: msg.content ?? '',
		ts: now(),
	};
	if (msg.tool_calls) { stored.tool_calls = msg.tool_calls; }
	if (msg.tool_call_id) { stored.tool_call_id = msg.tool_call_id; }
	if (msg.name) { stored.name = msg.name; }
	if (msg.model) { stored.model = msg.model; }
	if (msg.usage) { stored.usage = msg.usage; }
	if (msg.credits != null) { stored.credits = msg.credits; }
	if (msg.reasoning) { stored.reasoning = msg.reasoning; }
	list.push(stored);
	if (list.length > MAX_MESSAGES_PER_SESSION) { list.splice(0, list.length - MAX_MESSAGES_PER_SESSION); }
	s.updatedAt = now();
	scheduleSave();
	return stored;
}

// All messages, or only those with seq > sinceSeq (catch-up on reconnect).
export function messagesSince(userId, sessionId, sinceSeq = 0) {
	const s = getSession(userId, sessionId);
	if (!s) { return null; }
	const list = store.messages[sessionId] || [];
	return sinceSeq > 0 ? list.filter(m => m.seq > sinceSeq) : list.slice();
}

// Admin scope: platform-wide session/message stats + the most recent sessions.
export function adminStats(limit = 25) {
	ensureLoaded();
	const sessions = Object.values(store.sessions);
	const byUser = {};
	let totalMessages = 0;
	for (const s of sessions) { byUser[s.userId] = (byUser[s.userId] || 0) + 1; }
	for (const arr of Object.values(store.messages)) { totalMessages += arr.length; }
	const recent = sessions
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, limit)
		.map(s => ({ id: s.id, userId: s.userId, title: s.title, workspace: s.workspace, model: s.model, agentMode: s.agentMode, updatedAt: s.updatedAt, messages: (store.messages[s.id] || []).length }));
	return { totalSessions: sessions.length, totalMessages, users: Object.keys(byUser).length, byUser, recent };
}

// The turn history in the shape agentLoop feeds to the model (role/content plus
// tool metadata). Excludes 'error' rows (surfaced to the UI, not the model).
export function conversationForModel(userId, sessionId) {
	const s = getSession(userId, sessionId);
	if (!s) { return null; }
	return (store.messages[sessionId] || [])
		.filter(m => m.role !== 'error')
		.map(m => {
			const o = { role: m.role, content: m.content };
			if (m.tool_calls) { o.tool_calls = m.tool_calls; }
			if (m.tool_call_id) { o.tool_call_id = m.tool_call_id; }
			if (m.name) { o.name = m.name; }
			return o;
		});
}
