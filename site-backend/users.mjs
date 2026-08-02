// Users, sessions, and subscription lifecycle.

import { db, save } from './db.mjs';
import { hashPassword, verifyPassword, randomToken, sha256, normEmail, shortCode } from './security.mjs';
import { planOf, isPaidTier } from './plans.mjs';

const SESSION_TTL_MS = 30 * 24 * 3600_000; // 30 days
const VERIFY_TTL_MS = 24 * 3600_000;       // 24h to confirm email

function newId() { return 'u_' + randomToken(9); }

// Existing accounts (created before verification existed) have no field → treated
// as verified so they're never locked out. Only new users start unverified.
export function isVerified(user) { return !user || user.emailVerified !== false; }

export function findByVerifyToken(token) {
	if (!token) { return null; }
	return Object.values(db().users).find(u => u.verifyToken && u.verifyToken === token) || null;
}

// Confirm the email for the token. Returns the user or an error code.
export function verifyEmailToken(token) {
	const u = findByVerifyToken(token);
	if (!u) { return { ok: false, error: 'invalid_token' }; }
	if (u.verifyExpiresAt && Date.now() > u.verifyExpiresAt) { return { ok: false, error: 'expired' }; }
	u.emailVerified = true; u.verifyToken = null; u.verifyExpiresAt = null;
	save();
	return { ok: true, user: u };
}

// New token for a resend. Returns { token } or null if already verified/no user.
export function regenVerifyToken(email) {
	const u = findByEmail(email);
	if (!u || u.emailVerified !== false) { return null; }
	u.verifyToken = randomToken(24);
	u.verifyExpiresAt = Date.now() + VERIFY_TTL_MS;
	save();
	return { user: u, token: u.verifyToken };
}

// ---- accounts --------------------------------------------------------------

export function findByEmail(email) {
	const store = db();
	const id = store.emailIndex[normEmail(email)];
	return id ? store.users[id] : null;
}

export function getUser(id) { return db().users[id] || null; }

export function createUser(email, password, { plan = 'free' } = {}) {
	const store = db();
	const norm = normEmail(email);
	if (store.emailIndex[norm]) { return { ok: false, error: 'email_taken' }; }
	const id = newId();
	const now = Date.now();
	const user = {
		id,
		email: norm,
		name: norm.split('@')[0],
		passwordHash: hashPassword(password),
		plan,
		planExpiresAt: null,
		createdAt: now,
		isAdmin: false,
		referredBy: null,
		myReferralCode: shortCode(8),
		creditsGranted: 0,
		balanceRub: 0,          // wallet balance
		bonusCredits: 0,        // add-on credit pool (from packs)
		autoRenew: true,        // auto-renew the subscription at period end
		referralEarningsRub: 0, // lifetime referral reward earned
		emailVerified: false,   // must confirm email before login/use
		verifyToken: randomToken(24),
		verifyExpiresAt: now + VERIFY_TTL_MS,
	};
	store.users[id] = user;
	store.emailIndex[norm] = id;
	// index the user's own referral code so redemptions can resolve the owner
	store.referrals[user.myReferralCode] = {
		code: user.myReferralCode, ownerId: id, createdAt: now,
		uses: 0, maxUses: null, redemptions: [], kind: 'user',
	};
	save();
	return { ok: true, user };
}

// Find-or-create a user from a verified OAuth identity (Google). Email is already
// proven by the provider, so the account is verified immediately — no email sent.
export function oauthUpsert(email, name, provider = 'google') {
	const store = db();
	const norm = normEmail(email);
	const existing = store.emailIndex[norm] ? store.users[store.emailIndex[norm]] : null;
	if (existing) {
		let changed = false;
		if (existing.emailVerified === false) { existing.emailVerified = true; existing.verifyToken = null; existing.verifyExpiresAt = null; changed = true; }
		if (!existing.oauthProvider) { existing.oauthProvider = provider; changed = true; }
		if (changed) { save(); }
		return existing;
	}
	const id = newId();
	const now = Date.now();
	const user = {
		id, email: norm, name: name || norm.split('@')[0],
		passwordHash: hashPassword(randomToken(24)), // unusable random pw — they sign in via Google
		plan: 'free', planExpiresAt: null, createdAt: now, isAdmin: false,
		referredBy: null, myReferralCode: shortCode(8), creditsGranted: 0,
		balanceRub: 0, bonusCredits: 0, autoRenew: true, referralEarningsRub: 0,
		emailVerified: true, verifyToken: null, verifyExpiresAt: null,
		oauthProvider: provider,
	};
	store.users[id] = user;
	store.emailIndex[norm] = id;
	store.referrals[user.myReferralCode] = { code: user.myReferralCode, ownerId: id, createdAt: now, uses: 0, maxUses: null, redemptions: [], kind: 'user' };
	save();
	return user;
}

export function authenticate(email, password) {
	const user = findByEmail(email);
	if (!user) { return { ok: false, error: 'bad_credentials' }; }
	if (!verifyPassword(password, user.passwordHash)) { return { ok: false, error: 'bad_credentials' }; }
	return { ok: true, user };
}

export function setPassword(userId, password) {
	const u = getUser(userId);
	if (!u) { return false; }
	u.passwordHash = hashPassword(password);
	save();
	return true;
}

// ---- sessions --------------------------------------------------------------

export function createSession(userId, ua) {
	const token = randomToken(32);
	const now = Date.now();
	db().sessions[sha256(token)] = { userId, createdAt: now, expiresAt: now + SESSION_TTL_MS, ua: (ua || '').slice(0, 200) };
	save();
	return token;
}

export function sessionUser(token) {
	if (!token) { return null; }
	const store = db();
	const s = store.sessions[sha256(token)];
	if (!s) { return null; }
	if (Date.now() > s.expiresAt) { delete store.sessions[sha256(token)]; save(); return null; }
	return store.users[s.userId] || null;
}

export function revokeSession(token) {
	if (!token) { return; }
	const store = db();
	if (store.sessions[sha256(token)]) { delete store.sessions[sha256(token)]; save(); }
}

// ---- subscription lifecycle -----------------------------------------------

// Returns the plan that is actually in force *now* (auto-downgrades to free when
// a paid subscription has expired), persisting the downgrade.
export function effectivePlan(user) {
	if (!user) { return 'free'; }
	if (isPaidTier(user.plan) && user.planExpiresAt && Date.now() > user.planExpiresAt) {
		user.plan = 'free';
		user.planExpiresAt = null;
		save();
	}
	return user.plan || 'free';
}

export function setPlan(userId, planId, { days } = {}) {
	const u = getUser(userId);
	if (!u || !planOf(planId)) { return null; }
	const plan = planOf(planId);
	u.plan = planId;
	if (planId === 'free') {
		u.planExpiresAt = null;
	} else {
		const period = (days ?? plan.periodDays ?? 30) * 24 * 3600_000;
		// extend from now, or from the current expiry if still active (stacking)
		const base = (u.planExpiresAt && u.planExpiresAt > Date.now()) ? u.planExpiresAt : Date.now();
		u.planExpiresAt = base + period;
	}
	save();
	return publicUser(u);
}

// ---- projections -----------------------------------------------------------

export function publicUser(u) {
	if (!u) { return null; }
	const plan = effectivePlan(u);
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		plan,
		plan_label: planOf(plan).label,
		planExpiresAt: u.planExpiresAt || null,
		isAdmin: !!u.isAdmin,
		referralCode: u.myReferralCode,
		createdAt: u.createdAt,
		balanceRub: u.balanceRub || 0,
		bonusCredits: u.bonusCredits || 0,
		autoRenew: u.autoRenew !== false,
		referralEarningsRub: u.referralEarningsRub || 0,
		autoUpdate: u.autoUpdate || 'notify', // 'off' | 'notify' | 'silent'
	};
}

const AUTO_UPDATE_MODES = ['off', 'notify', 'silent'];
export function setAutoUpdate(userId, mode) {
	if (!AUTO_UPDATE_MODES.includes(mode)) { return { ok: false, error: 'bad_mode' }; }
	const u = db().users[userId];
	if (!u) { return { ok: false, error: 'no_user' }; }
	u.autoUpdate = mode;
	save();
	return { ok: true, autoUpdate: mode };
}
export function getAutoUpdate(userId) {
	const u = db().users[userId];
	return (u && u.autoUpdate) || 'notify';
}

// ---- wallet & add-ons ------------------------------------------------------

export function adjustBalance(userId, deltaRub, reason, ref) {
	const u = getUser(userId);
	if (!u) { return null; }
	u.balanceRub = Math.round(((u.balanceRub || 0) + deltaRub) * 100) / 100;
	db().balanceTx.push({ id: 'bt_' + randomToken(8), userId, ts: Date.now(), deltaRub, reason: reason || 'adjust', ref: ref || null, balanceAfter: u.balanceRub });
	save();
	return u.balanceRub;
}

export function addBonusCredits(userId, n) {
	const u = getUser(userId);
	if (!u) { return null; }
	u.bonusCredits = (u.bonusCredits || 0) + n;
	save();
	return u.bonusCredits;
}

export function setAutoRenew(userId, on) {
	const u = getUser(userId);
	if (!u) { return null; }
	u.autoRenew = !!on;
	save();
	return u.autoRenew;
}

export function addReferralEarnings(userId, rub) {
	const u = getUser(userId);
	if (!u) { return null; }
	u.referralEarningsRub = Math.round(((u.referralEarningsRub || 0) + rub) * 100) / 100;
	save();
	return u.referralEarningsRub;
}

export function balanceLedger(userId, limit = 50) {
	return db().balanceTx.filter(t => t.userId === userId).slice(-limit).reverse();
}

export function listUsers() {
	return Object.values(db().users).map(publicUser);
}
