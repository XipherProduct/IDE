// Promo codes: percent or fixed-ruble discounts, scoped to a purchase target
// (plan / credits / topup / any), with optional max-uses, min-spend and expiry.

import { db, save } from './db.mjs';

function norm(code) { return String(code || '').trim().toUpperCase(); }

export function createPromo({ code, kind, value, appliesTo = 'any', maxUses = null, minRub = 0, expiresAt = null }) {
	const c = norm(code);
	if (!c || !/^[A-Z0-9_-]{3,32}$/.test(c)) { return { ok: false, error: 'bad_code' }; }
	if (kind !== 'percent' && kind !== 'fixed') { return { ok: false, error: 'bad_kind' }; }
	value = Number(value);
	if (!(value > 0)) { return { ok: false, error: 'bad_value' }; }
	if (kind === 'percent' && value > 90) { return { ok: false, error: 'percent_too_big' }; }
	if (!['plan', 'credits', 'topup', 'any'].includes(appliesTo)) { return { ok: false, error: 'bad_scope' }; }
	const store = db();
	store.promos[c] = {
		code: c, kind, value, appliesTo,
		maxUses: maxUses ? Number(maxUses) : null,
		uses: 0, minRub: Number(minRub) || 0,
		expiresAt: expiresAt ? Number(expiresAt) : null,
		active: true, createdAt: Date.now(),
	};
	save();
	return { ok: true, promo: store.promos[c] };
}

export function listPromos() {
	return Object.values(db().promos).sort((a, b) => b.createdAt - a.createdAt);
}

export function setPromoActive(code, active) {
	const p = db().promos[norm(code)];
	if (!p) { return false; }
	p.active = !!active; save();
	return true;
}

export function deletePromo(code) {
	const store = db();
	if (!store.promos[norm(code)]) { return false; }
	delete store.promos[norm(code)]; save();
	return true;
}

// Validate + compute discount for a purchase of `baseRub` toward `target`.
export function evalPromo(code, target, baseRub) {
	const p = db().promos[norm(code)];
	if (!p) { return { ok: false, error: 'not_found' }; }
	if (!p.active) { return { ok: false, error: 'inactive' }; }
	if (p.expiresAt && Date.now() > p.expiresAt) { return { ok: false, error: 'expired' }; }
	if (p.maxUses != null && p.uses >= p.maxUses) { return { ok: false, error: 'used_up' }; }
	if (p.appliesTo !== 'any' && p.appliesTo !== target) { return { ok: false, error: 'wrong_target' }; }
	if (baseRub < p.minRub) { return { ok: false, error: 'below_min', minRub: p.minRub }; }
	const discount = p.kind === 'percent'
		? Math.floor(baseRub * (p.value / 100))
		: Math.min(baseRub, Math.floor(p.value));
	const finalRub = Math.max(0, baseRub - discount);
	return { ok: true, promo: p, discountRub: discount, finalRub, label: p.kind === 'percent' ? `−${p.value}%` : `−${p.value} ₽` };
}

export function consumePromo(code) {
	const p = db().promos[norm(code)];
	if (p) { p.uses = (p.uses || 0) + 1; save(); }
}

export function promoStats() {
	const promos = listPromos();
	return { total: promos.length, active: promos.filter(p => p.active).length, redemptions: promos.reduce((n, p) => n + (p.uses || 0), 0) };
}
