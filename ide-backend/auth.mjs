// Security layer for the Xipher IDE backend.
//
// Implements exactly the contract the desktop IDE (alaskaAuthService /
// alaskaApiClient) speaks:
//   - device-authorization flow: /api/auth/device/init, /device/poll, /refresh, /revoke
//   - per-request HMAC: X-Checksum = HMAC_SHA256(hmacSecret, `${userId}\n${METHOD}\n${path}\n${minuteBucket}`)
//     sent with Authorization: Bearer <accessToken> and X-Client-Key: <clientKey>
//
// Every /api/ai/* and /api/index/* call is verified: valid access token →
// session → user's hmacSecret+clientKey → recompute checksum (current and
// previous minute to tolerate clock skew) → constant-time compare.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

// Approval of a device is gated by an admin token (only the owner can bind a
// device to an account). Set ADMIN_TOKEN in the environment; if absent we
// generate one on first boot and persist it (printed once to the log).
let ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const ACCESS_TTL_MS = 1000 * 60 * 60 * 24 * 7;      // 7d access
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 90;    // 90d refresh
const DEVICE_TTL_MS = 1000 * 60 * 10;               // 10m to approve
const DEVICE_INTERVAL = 3;                          // poll seconds

function rand(bytes = 32) { return crypto.randomBytes(bytes).toString('hex'); }
function userCode() {
	const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)];
	return s.slice(0, 4) + '-' + s.slice(4);
}

// ---- persistent store ------------------------------------------------------

let store = { users: {}, devices: {}, sessions: {}, meta: {} };
function load() {
	try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
	catch { store = { users: {}, devices: {}, sessions: {}, meta: {} }; }
	if (!store.users) store.users = {};
	if (!store.devices) store.devices = {};
	if (!store.sessions) store.sessions = {};
	if (!store.meta) store.meta = {};
}
function save() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const tmp = STORE_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(store));
	fs.renameSync(tmp, STORE_PATH);
}

export function initAuth() {
	load();
	// migrate: the owner account should be on the top tier (created before plans existed → 'free')
	if (store.users.owner && (!store.users.owner.profile || !store.users.owner.profile.plan || store.users.owner.profile.plan === 'free')) {
		store.users.owner.profile = { ...(store.users.owner.profile || { id: 'owner', email: '', name: 'Owner' }), plan: 'maxx10' };
		save();
	}
	if (!ADMIN_TOKEN) {
		if (!store.meta.adminToken) { store.meta.adminToken = rand(24); save(); }
		ADMIN_TOKEN = store.meta.adminToken;
		console.log(`[auth] ADMIN_TOKEN (device approval): ${ADMIN_TOKEN}`);
	}
}

// ---- users / crypto --------------------------------------------------------

function defaultPlanFor(userId) { return userId === 'owner' ? 'maxx10' : 'free'; }

function ensureUser(userId) {
	if (!store.users[userId]) {
		store.users[userId] = {
			hmacSecret: rand(32), clientKey: rand(16), createdAt: Date.now(),
			profile: { id: userId, email: '', name: userId === 'owner' ? 'Owner' : userId, plan: defaultPlanFor(userId) },
		};
		save();
	}
	if (!store.users[userId].profile) {
		store.users[userId].profile = { id: userId, email: '', name: 'Owner', plan: defaultPlanFor(userId) };
		save();
	}
	return store.users[userId];
}

// Current plan id for a user (defaults to 'free').
export function userPlan(userId) {
	const u = store.users[userId];
	return (u && u.profile && u.profile.plan) || 'free';
}
// Admin: change a user's plan.
export function setUserPlan(userId, plan) {
	ensureUser(userId);
	store.users[userId].profile.plan = plan;
	save();
	return store.users[userId].profile;
}

// ---- admin helpers ---------------------------------------------------------

export function isAdmin(token) { return !!token && tsEqual(token, ADMIN_TOKEN); }

export function listUsers() {
	return Object.entries(store.users).map(([id, u]) => ({
		id,
		name: (u.profile && u.profile.name) || id,
		plan: (u.profile && u.profile.plan) || 'free',
		createdAt: u.createdAt || 0,
		sessions: Object.values(store.sessions).filter(s => s.userId === id).length,
	}));
}

export function listPendingDevices() {
	return Object.values(store.devices)
		.filter(d => d.status === 'pending' && Date.now() < d.expiresAt)
		.map(d => ({ user_code: d.user_code, createdAt: d.createdAt, expiresAt: d.expiresAt }));
}

// HMAC exactly matching the IDE client (alaskaApiClient.signChecksum).
function signChecksum(secretHex, subject, method, reqPath, bucket) {
	const key = Buffer.from(secretHex, 'hex');
	const msg = `${subject}\n${method.toUpperCase()}\n${reqPath}\n${bucket}`;
	return crypto.createHmac('sha256', key).update(msg).digest('hex');
}
function tsEqual(a, b) {
	const ba = Buffer.from(a || '', 'utf8'), bb = Buffer.from(b || '', 'utf8');
	if (ba.length !== bb.length) return false;
	return crypto.timingSafeEqual(ba, bb);
}

// ---- device flow -----------------------------------------------------------

export function deviceInit(verificationBase) {
	const device_code = rand(24);
	const user_code = userCode();
	store.devices[device_code] = {
		user_code, status: 'pending', userId: null,
		createdAt: Date.now(), expiresAt: Date.now() + DEVICE_TTL_MS,
	};
	save();
	return {
		device_code, user_code,
		verification_uri: `${verificationBase}/ide-api/device`,
		verification_uri_complete: `${verificationBase}/ide-api/device?code=${user_code}`,
		interval: DEVICE_INTERVAL,
		expires_in: Math.floor(DEVICE_TTL_MS / 1000),
	};
}

// Admin-gated approval: binds a pending device (by user_code) to an account.
// Kept as an owner/ops fallback; normal users approve via their Xipher account.
export function deviceApprove(adminToken, user_code, userId) {
	if (!tsEqual(adminToken, ADMIN_TOKEN)) return { ok: false, error: 'forbidden' };
	const dev = Object.values(store.devices).find(d => d.user_code === user_code && d.status === 'pending');
	if (!dev) return { ok: false, error: 'unknown_or_used_code' };
	if (Date.now() > dev.expiresAt) return { ok: false, error: 'expired' };
	const uid = userId || 'owner';
	ensureUser(uid);
	dev.status = 'approved'; dev.userId = uid;
	save();
	return { ok: true, userId: uid };
}

// Site plans → IDE plan tiers (the IDE tops out at maxx10).
function mapSitePlan(p) { return ({ maxx20: 'maxx10' })[p] || p || 'free'; }

// Approve a device by binding it to a verified Xipher (site) account. The IDE
// user is keyed by the site user id, and its profile (email/name/plan) is synced
// from the account so a plan bought on the site takes effect in the IDE.
export function bindDeviceToUser(user_code, siteUser) {
	if (!siteUser || !siteUser.id) return { ok: false, error: 'bad_credentials' };
	const dev = Object.values(store.devices).find(d => d.user_code === user_code && d.status === 'pending');
	if (!dev) return { ok: false, error: 'unknown_or_used_code' };
	if (Date.now() > dev.expiresAt) return { ok: false, error: 'expired' };
	const uid = siteUser.id;
	if (!store.users[uid]) {
		store.users[uid] = { hmacSecret: rand(32), clientKey: rand(16), createdAt: Date.now(), profile: {} };
	}
	store.users[uid].profile = {
		id: uid,
		email: siteUser.email || '',
		name: siteUser.name || (siteUser.email || '').split('@')[0] || uid,
		plan: mapSitePlan(siteUser.plan),
	};
	dev.status = 'approved'; dev.userId = uid;
	save();
	return { ok: true, userId: uid };
}

// Re-sync a user's plan from the site account (call on refresh so upgrades apply).
export function syncUserPlan(userId, sitePlan) {
	const u = store.users[userId];
	if (!u || !u.profile) return;
	const mapped = mapSitePlan(sitePlan);
	if (u.profile.plan !== mapped) { u.profile.plan = mapped; save(); }
}

// Issue a session and return snake_case creds matching the IDE contract
// (IDevicePollResp / IRefreshResp). `refresh_family` chains rotations.
function issueSession(userId, family) {
	const accessToken = rand(24), refreshToken = rand(24);
	const refresh_family = family || rand(12);
	store.sessions[accessToken] = {
		userId, refreshToken, refresh_family,
		accessExpiresAt: Date.now() + ACCESS_TTL_MS,
		refreshExpiresAt: Date.now() + REFRESH_TTL_MS,
	};
	save();
	const u = store.users[userId];
	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		refresh_family,
		expires_in: Math.floor(ACCESS_TTL_MS / 1000),
		hmac_secret: u.hmacSecret,
		client_key: u.clientKey,
		user: u.profile,
	};
}

// GET /api/auth/device/poll?device_code=... — statuses 200/202/410/404
export function devicePoll(device_code) {
	const dev = store.devices[device_code];
	if (!dev) return { status: 404, body: { status: 'expired' } };
	if (Date.now() > dev.expiresAt) { delete store.devices[device_code]; save(); return { status: 410, body: { status: 'expired' } }; }
	if (dev.status === 'pending') return { status: 202, body: { status: 'pending' } };
	if (dev.status === 'denied') return { status: 200, body: { status: 'denied' } };
	if (dev.status === 'approved') {
		const creds = issueSession(dev.userId);
		delete store.devices[device_code]; save();
		return { status: 200, body: { status: 'approved', ...creds } };
	}
	return { status: 200, body: { status: 'denied' } };
}

export function refresh(refreshToken, family) {
	const entry = Object.entries(store.sessions).find(([, s]) => s.refreshToken === refreshToken);
	if (!entry) return { status: 200, body: { status: 'invalid' } };
	const [oldAccess, s] = entry;
	if (Date.now() > s.refreshExpiresAt) { delete store.sessions[oldAccess]; save(); return { status: 200, body: { status: 'expired' } }; }
	// rotation-reuse guard: family must match if supplied
	if (family && s.refresh_family && family !== s.refresh_family) return { status: 200, body: { status: 'reuse-detected' } };
	delete store.sessions[oldAccess];
	const creds = issueSession(s.userId, s.refresh_family);
	return { status: 200, body: { status: 'ok', access_token: creds.access_token, refresh_token: creds.refresh_token, refresh_family: creds.refresh_family, expires_in: creds.expires_in, user: creds.user } };
}

export function revoke(accessToken) {
	if (store.sessions[accessToken]) { delete store.sessions[accessToken]; save(); }
	return { status: 200, body: { revoked: true } };
}

// ---- per-request verification ---------------------------------------------

// Returns { ok:true, userId } or { ok:false, status, error }.
export function verifyRequest(headers, method, reqPath) {
	const auth = headers['authorization'] || '';
	const m = /^Bearer\s+(.+)$/i.exec(auth);
	if (!m) return { ok: false, status: 401, error: 'missing_bearer' };
	const sess = store.sessions[m[1]];
	if (!sess) return { ok: false, status: 401, error: 'invalid_token' };
	if (Date.now() > sess.accessExpiresAt) return { ok: false, status: 401, error: 'token_expired' };
	const user = store.users[sess.userId];
	if (!user) return { ok: false, status: 401, error: 'no_user' };

	const clientKey = headers['x-client-key'] || '';
	if (!tsEqual(clientKey, user.clientKey)) return { ok: false, status: 401, error: 'bad_client_key' };

	const checksum = headers['x-checksum'] || '';
	const bucket = Math.floor(Date.now() / 1000 / 60);
	// accept current and previous minute (clock skew / request in flight)
	for (const b of [bucket, bucket - 1, bucket + 1]) {
		const expected = signChecksum(user.hmacSecret, sess.userId, method, reqPath, b);
		if (tsEqual(checksum, expected)) return { ok: true, userId: sess.userId };
	}
	return { ok: false, status: 401, error: 'bad_checksum' };
}

// test/helper: expose signing so a client simulation can build headers
export const _test = { signChecksum, ensureUser, getUser: (id) => store.users[id] };
