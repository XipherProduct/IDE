// Security primitives — zero-dep (node:crypto only).
// Password hashing (scrypt), secure random tokens, constant-time compare,
// a sliding-window rate limiter, and small input validators.

import crypto from 'node:crypto';

// ---- passwords (scrypt) ----------------------------------------------------

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 32;

export function hashPassword(password) {
	const salt = crypto.randomBytes(16);
	const dk = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
	return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(password, stored) {
	try {
		const [scheme, n, r, p, saltB64, hashB64] = String(stored).split('$');
		if (scheme !== 'scrypt') { return false; }
		const salt = Buffer.from(saltB64, 'base64');
		const expected = Buffer.from(hashB64, 'base64');
		const dk = crypto.scryptSync(String(password), salt, expected.length, { N: +n, r: +r, p: +p });
		return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
	} catch {
		return false;
	}
}

// ---- tokens ----------------------------------------------------------------

export function randomToken(bytes = 32) {
	return crypto.randomBytes(bytes).toString('base64url');
}

// short, human-shareable code (referral codes, user codes)
export function shortCode(len = 8) {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const buf = crypto.randomBytes(len);
	let out = '';
	for (let i = 0; i < len; i++) { out += alphabet[buf[i] % alphabet.length]; }
	return out;
}

export function sha256(s) {
	return crypto.createHash('sha256').update(String(s)).digest('hex');
}

export function safeEqual(a, b) {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ba.length !== bb.length) { return false; }
	return crypto.timingSafeEqual(ba, bb);
}

// ---- validators ------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(s) {
	return typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s);
}

export function normEmail(s) {
	return String(s || '').trim().toLowerCase();
}

export function passwordProblem(pw) {
	if (typeof pw !== 'string') { return 'Пароль обязателен'; }
	if (pw.length < 8) { return 'Минимум 8 символов'; }
	if (pw.length > 200) { return 'Слишком длинный пароль'; }
	if (!/[a-zа-я]/i.test(pw) || !/[0-9]/.test(pw)) { return 'Нужны буквы и цифры'; }
	return null;
}

// ---- sliding-window rate limiter (per-key, in-memory) ----------------------

const buckets = new Map(); // key -> number[] (timestamps)

export function rateLimit(key, max, windowMs) {
	const now = Date.now();
	const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
	if (arr.length >= max) {
		const retryMs = windowMs - (now - arr[0]);
		return { ok: false, retryAfterS: Math.ceil(retryMs / 1000) };
	}
	arr.push(now);
	buckets.set(key, arr);
	return { ok: true, remaining: max - arr.length };
}

// opportunistic cleanup so the map can't grow unbounded
let lastSweep = 0;
export function sweepRateLimiter(windowMs = 3600_000) {
	const now = Date.now();
	if (now - lastSweep < 60_000) { return; }
	lastSweep = now;
	for (const [k, arr] of buckets) {
		const live = arr.filter(t => now - t < windowMs);
		if (live.length) { buckets.set(k, live); } else { buckets.delete(k); }
	}
}
