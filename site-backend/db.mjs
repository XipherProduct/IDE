// Tiny persistent JSON store (atomic writes). Zero-dep. Good enough for a single
// node; swap for Postgres later without touching callers (all access goes through
// the exported collection helpers).

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'site.json');

const EMPTY = {
	users: {},        // userId -> user
	emailIndex: {},   // normalizedEmail -> userId
	sessions: {},     // tokenHash -> { userId, createdAt, expiresAt, ua }
	referrals: {},    // code -> { code, ownerId, createdAt, uses, maxUses, redemptions: [] }
	purchases: [],    // { id, userId, plan, priceRub, ts, kind, ref }  (legacy ledger)
	usage: {},        // userId -> [{ ts, credits, model }]
	invoices: [],     // { id, userId, ts, kind, items[], subtotalRub, discountRub, totalRub, method, promo, status, meta }
	promos: {},       // CODE -> { code, kind, value, appliesTo, maxUses, uses, minRub, expiresAt, active, createdAt }
	balanceTx: [],    // { id, userId, ts, deltaRub, reason, ref }  (wallet ledger)
};

let state = null;
let saveTimer = null;

function ensureDir() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load() {
	if (state) { return state; }
	try {
		state = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
	} catch {
		state = structuredClone(EMPTY);
	}
	// backfill any missing collections after a schema bump
	for (const k of Object.keys(EMPTY)) {
		if (state[k] === undefined) { state[k] = structuredClone(EMPTY[k]); }
	}
	return state;
}

export function db() { return load(); }

function writeNow() {
	ensureDir();
	const tmp = DB_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(state));
	fs.renameSync(tmp, DB_PATH);
}

// Debounced save so a burst of writes coalesces; flush() forces it.
export function save() {
	if (saveTimer) { return; }
	saveTimer = setTimeout(() => { saveTimer = null; try { writeNow(); } catch (e) { console.error('[db] save failed', e); } }, 50);
}

export function flush() {
	if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
	try { writeNow(); } catch (e) { console.error('[db] flush failed', e); }
}

// persist on shutdown so debounced writes aren't lost
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('SIGINT', () => { flush(); process.exit(0); });
