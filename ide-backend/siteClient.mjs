// Loopback client for the site backend — the single source of truth for the
// credit ledger, plan, versioning, and (new) web-session identity resolution.
// Extracted from server.mjs so the agent loop and the WS layer share it.

const SITE_BACKEND_URL = process.env.SITE_BACKEND_URL || 'http://127.0.0.1:8096';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

function internalHeaders(extra = {}) {
	return { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET, ...extra };
}

// authorize: may this user spend `cost` now? Returns the parsed body (incl. live
// plan), or null if the site is unreachable (caller falls back to the local ledger).
export async function siteAuthorize(userId, cost) {
	if (!INTERNAL_SECRET) { return null; }
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/internal/authorize`, {
			method: 'POST', headers: internalHeaders(), body: JSON.stringify({ userId, cost }),
		});
		if (!r.ok) { return null; }
		return await r.json();
	} catch { return null; }
}

export async function siteCharge(userId, cost, model) {
	if (!INTERNAL_SECRET) { return false; }
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/internal/charge`, {
			method: 'POST', headers: internalHeaders(), body: JSON.stringify({ userId, cost, model }),
		});
		return r.ok;
	} catch { return false; }
}

export async function siteVersion() {
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/version`);
		return r.ok ? await r.json() : null;
	} catch { return null; }
}

export async function siteAutoUpdateMode(userId) {
	if (!INTERNAL_SECRET) { return 'notify'; }
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/internal/auto-update?userId=${encodeURIComponent(userId)}`, {
			headers: internalHeaders(),
		});
		return r.ok ? ((await r.json()).autoUpdate || 'notify') : 'notify';
	} catch { return 'notify'; }
}

// Resolve a web (site) session bearer token to an identity. This is how the web
// Code platform authenticates: the browser holds a site session token; the
// ide-backend resolves it to { userId, plan, email, name } via the site backend.
// Returns null on an invalid/expired token or if the site is unreachable.
// A short in-process cache keeps WS-ticket minting cheap without letting a
// revoked session linger long.
const RESOLVE_CACHE_TTL = 30_000;
const resolveCache = new Map(); // token -> { at, value }

export async function resolveWebUser(token) {
	if (!INTERNAL_SECRET || !token) { return null; }
	const cached = resolveCache.get(token);
	if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL) { return cached.value; }
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/internal/session`, {
			method: 'POST', headers: internalHeaders(), body: JSON.stringify({ token }),
		});
		if (!r.ok) { resolveCache.set(token, { at: Date.now(), value: null }); return null; }
		const d = await r.json();
		const value = d && d.userId ? { userId: d.userId, plan: d.plan || 'free', email: d.email || '', name: d.name || '' } : null;
		resolveCache.set(token, { at: Date.now(), value });
		return value;
	} catch { return null; }
}
