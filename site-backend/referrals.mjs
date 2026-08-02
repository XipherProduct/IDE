// Referrals: a *paid* user shares their code; a new/free user redeems it to buy
// Pro for 7 days at 49 ₽ (the `trial` tier). Anti-abuse: one redemption per user,
// no self-referral, owner must currently hold a paid plan, redeemer must not
// already be paid.

import { db, save } from './db.mjs';
import { PLANS } from './plans.mjs';
import { getUser, effectivePlan, setPlan } from './users.mjs';
import { purchaseReferralTrial } from './billing.mjs';

const TRIAL = PLANS.trial; // Pro 7d @ 49₽

function isPaidNow(user) {
	const p = effectivePlan(user);
	return p === 'pro' || p === 'maxx5' || p === 'maxx20';
}

// The shareable link a user can hand out — gated to paid tiers.
export function referralInfo(user, publicBase) {
	const store = db();
	const rec = store.referrals[user.myReferralCode];
	const eligible = isPaidNow(user);
	return {
		eligible,
		reason: eligible ? null : 'Реф-ссылка доступна только на платном тарифе',
		code: user.myReferralCode,
		url: `${publicBase.replace(/\/$/, '')}/#/r/${user.myReferralCode}`,
		redeemPriceRub: TRIAL.priceRub,
		grantsDays: TRIAL.periodDays,
		uses: rec ? rec.uses : 0,
	};
}

export function lookupReferral(code) {
	const rec = db().referrals[String(code || '').toUpperCase()];
	if (!rec) { return null; }
	const owner = getUser(rec.ownerId);
	if (!owner) { return null; }
	return { rec, owner, ownerPaid: isPaidNow(owner) };
}

// Preview shown on the redeem page (no auth needed).
export function referralPreview(code) {
	const found = lookupReferral(code);
	if (!found) { return { ok: false, error: 'not_found' }; }
	return {
		ok: true,
		valid: found.ownerPaid,
		reason: found.ownerPaid ? null : 'Пригласивший больше не на платном тарифе',
		code: found.rec.code,
		inviter: found.owner.name,
		priceRub: TRIAL.priceRub,
		days: TRIAL.periodDays,
		plan_label: 'Pro',
	};
}

// Redeem. Routes the 49₽ trial through the real payment flow (billing): pay from
// wallet ('balance') → instant, or card → pending gateway payment. The trial grant
// + inviter reward happen only when the payment settles (billing.applyOrderEffects).
export async function redeemReferral(code, redeemer, method = 'card') {
	const found = lookupReferral(code);
	if (!found) { return { ok: false, error: 'not_found' }; }
	const { rec, owner, ownerPaid } = found;

	if (!ownerPaid) { return { ok: false, error: 'inviter_not_paid' }; }
	if (owner.id === redeemer.id) { return { ok: false, error: 'self_referral' }; }
	if (redeemer.referredBy) { return { ok: false, error: 'already_referred' }; }
	if (isPaidNow(redeemer)) { return { ok: false, error: 'already_paid' }; }

	const r = await purchaseReferralTrial(redeemer, rec, owner, method);
	if (r.paid) { r.grantedDays = TRIAL.periodDays; }
	return r;
}

// Campaign code: a shareable code redeemable by ANY new user for the 49₽ Pro-7d
// trial (for marketing pushes). Reuses the referral redeem flow + anti-abuse
// (1 per user, not-already-paid). Owned by a house account which we keep paid so
// the owner-paid gate passes. Same redeem endpoint / link as a normal referral.
export function createCampaignReferral(code, owner) {
	const c = String(code || '').trim().toUpperCase();
	if (!/^[A-Z0-9_-]{3,24}$/.test(c)) { return { ok: false, error: 'bad_code' }; }
	if (!owner) { return { ok: false, error: 'no_owner' }; }
	const store = db();
	const existing = store.referrals[c];
	if (existing && existing.kind === 'user') { return { ok: false, error: 'code_taken' }; }
	// keep the house/owner account on a long paid plan so redeem never breaks
	setPlan(owner.id, 'maxx20', { days: 3650 });
	store.referrals[c] = {
		code: c, ownerId: owner.id, kind: 'campaign',
		createdAt: existing?.createdAt || Date.now(),
		uses: existing?.uses || 0, maxUses: null, redemptions: existing?.redemptions || [],
	};
	save();
	return { ok: true, code: c, url: `https://ide.xipher.pro/#/r/${c}`, ownerEmail: owner.email, priceRub: TRIAL.priceRub, days: TRIAL.periodDays };
}

export function referralLeaderboard(limit = 20) {
	return Object.values(db().referrals)
		.filter(r => r.kind === 'user' && r.uses > 0)
		.map(r => ({ code: r.code, ownerId: r.ownerId, uses: r.uses }))
		.sort((a, b) => b.uses - a.uses)
		.slice(0, limit);
}
