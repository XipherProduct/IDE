// Per-user memory store: durable facts about a user, injected read-only into the
// system prompt so chats/sessions recall context across time (like the desktop's
// memory, but server-side and shared by web + IDE).
//
// Phase 1 wires the recall() slot into the agent loop (empty until facts exist).
// remember()/forget() back the regular-chat memory surface (Phase 4). Facts are
// injected as background context, never as instructions, and are never model-
// writable except through an explicit, gated remember() call.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'memory.json');
const MAX_FACTS_PER_USER = 200;

let store = { users: {} }; // userId -> [{ id, text, source, createdAt, updatedAt }]
let loaded = false;

function load() {
	try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
	catch { store = { users: {} }; }
	store.users ||= {};
	loaded = true;
}
function ensureLoaded() { if (!loaded) { load(); } }
function save() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const tmp = STORE_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(store));
	fs.renameSync(tmp, STORE_PATH);
}

// Recall a user's facts (for prompt injection). Returns [{ text, ... }].
export function recall(userId) {
	ensureLoaded();
	return (store.users[userId] || []).slice();
}

export function listFacts(userId) { return recall(userId); }

export function remember(userId, text, source = 'user') {
	ensureLoaded();
	const t = String(text || '').trim().slice(0, 1000);
	if (!t) { return null; }
	const list = store.users[userId] || (store.users[userId] = []);
	// de-dupe on identical text
	const existing = list.find(f => f.text === t);
	if (existing) { existing.updatedAt = Date.now(); save(); return existing; }
	const fact = { id: 'f_' + crypto.randomBytes(6).toString('hex'), text: t, source, createdAt: Date.now(), updatedAt: Date.now() };
	list.push(fact);
	if (list.length > MAX_FACTS_PER_USER) { list.splice(0, list.length - MAX_FACTS_PER_USER); }
	save();
	return fact;
}

// Admin scope: platform-wide memory stats.
export function adminStats() {
	ensureLoaded();
	let total = 0;
	for (const arr of Object.values(store.users)) { total += arr.length; }
	return { users: Object.keys(store.users).length, totalFacts: total };
}

export function forget(userId, factId) {
	ensureLoaded();
	const list = store.users[userId];
	if (!list) { return false; }
	const i = list.findIndex(f => f.id === factId);
	if (i === -1) { return false; }
	list.splice(i, 1);
	save();
	return true;
}
