// Billing — wallet, invoices, promos, annual/proration checkout, credit packs,
// refunds, auto-renew. NO fake payments: card purchases go through a real gateway
// (payments.mjs → YooKassa) as a pending invoice that is only granted once the
// webhook confirms. Wallet ('balance') pays instantly from real internal money.

import { db, save } from './db.mjs';
import { randomToken } from './security.mjs';
import {
	PLANS, PURCHASABLE, planOf, isPaidTier, annualPrice, creditPack,
	TOPUP_MIN, TOPUP_MAX, REFERRAL_REWARD_RUB,
} from './plans.mjs';
import {
	getUser, setPlan, publicUser, adjustBalance, addBonusCredits, addReferralEarnings,
} from './users.mjs';
import { evalPromo, consumePromo } from './promos.mjs';
import { paymentsEnabled, createPayment, fetchPayment } from './payments.mjs';

function invId() { return 'inv_' + randomToken(10); }
function returnUrl() { return `${(process.env.PUBLIC_BASE || 'http://localhost:5173').replace(/\/$/, '')}/#/billing`; }

// ---- invoice records -------------------------------------------------------

const lineSum = items => items.reduce((s, it) => s + it.amountRub * (it.qty || 1), 0);

function newInvoice(userId, kind, items, { method, promo = null, status, meta = {} }) {
	const subtotalRub = items.filter(it => it.amountRub > 0).reduce((s, it) => s + it.amountRub * (it.qty || 1), 0);
	const discountRub = items.filter(it => it.amountRub < 0).reduce((s, it) => s - it.amountRub * (it.qty || 1), 0);
	const totalRub = Math.max(0, lineSum(items));
	const inv = { id: invId(), userId, ts: Date.now(), kind, items, subtotalRub, discountRub, totalRub, method, promo, status, meta };
	db().invoices.push(inv);
	save();
	return inv;
}

// Record real cash in the revenue ledger (only paid invoices count).
function ledgerPurchase(inv) {
	db().purchases.push({ id: inv.id, userId: inv.userId, plan: inv.meta?.effects?.plan?.id || null, priceRub: inv.totalRub, kind: inv.kind, ref: inv.meta?.ref || null, ts: Date.now() });
	save();
}

export function invoicesFor(userId, limit = 100) { return db().invoices.filter(i => i.userId === userId).slice(-limit).reverse(); }
export function invoiceById(id) { return db().invoices.find(i => i.id === id) || null; }
export function recentInvoices(limit = 100) { return db().invoices.slice(-limit).reverse(); }
export function recentPurchases(limit = 50) { return db().purchases.slice(-limit).reverse(); }

// ---- order effects (what the payment delivers) -----------------------------

// effects: { plan?:{id,days}, credits?:n, balanceRub?:n, referral?:{code,ownerId,redeemerId} }
function applyOrderEffects(userId, effects, invoiceId) {
	if (!effects) { return; }
	if (effects.plan) { setPlan(userId, effects.plan.id, { days: effects.plan.days }); }
	if (effects.credits) { addBonusCredits(userId, effects.credits); }
	if (effects.balanceRub) { adjustBalance(userId, effects.balanceRub, 'topup', invoiceId); }
	if (effects.referral) {
		const { code, ownerId, redeemerId } = effects.referral;
		const rec = db().referrals[code];
		const redeemer = getUser(redeemerId);
		if (rec && redeemer && !redeemer.referredBy) {
			rec.uses = (rec.uses || 0) + 1;
			rec.redemptions.push({ userId: redeemerId, at: Date.now(), priceRub: PLANS.trial.priceRub });
			redeemer.referredBy = { code, ownerId, at: Date.now() };
			rewardReferrer(ownerId, code);
			save();
		}
	}
}

// Confirm a pending invoice (called by the webhook after gateway says succeeded).
// Idempotent: re-confirming a paid invoice is a no-op.
export function finalizeInvoice(invoiceId) {
	const inv = invoiceById(invoiceId);
	if (!inv) { return { ok: false, error: 'no_invoice' }; }
	if (inv.status === 'paid') { return { ok: true, invoice: inv, already: true }; }
	if (inv.status !== 'pending') { return { ok: false, error: 'bad_status' }; }
	inv.status = 'paid'; inv.paidAt = Date.now();
	applyOrderEffects(inv.userId, inv.meta?.effects, inv.id);
	ledgerPurchase(inv);
	save();
	return { ok: true, invoice: inv };
}

// ---- gateway reconciliation ------------------------------------------------

export function invoiceByPaymentId(txId) {
	return db().invoices.find(i => i.meta?.paymentId === txId) || null;
}

// Ask the gateway for the AUTHORITATIVE status of a pending invoice's payment and
// settle it. This is the trust anchor of the whole payment flow: nothing is ever
// granted from an inbound request body — a plan/credits are delivered ONLY when
// Platega itself (queried server-to-server with our secret) reports CONFIRMED for
// the exact transaction, AND the paid amount covers the invoice. A forged webhook
// therefore can't grant anything: the attacker cannot make Platega lie.
export async function reconcileInvoice(invoiceId) {
	const inv = invoiceById(invoiceId);
	if (!inv) { return { ok: false, error: 'no_invoice' }; }
	if (inv.status !== 'pending') { return { ok: true, status: inv.status }; }
	const txId = inv.meta?.paymentId;
	if (!txId) { return { ok: true, status: 'pending' }; }

	const p = await fetchPayment(txId);
	if (!p.ok) { return { ok: true, status: 'pending' }; } // couldn't reach gateway → leave pending, sweep retries

	if (p.status === 'succeeded') {
		// anti-underpayment: only grant if the confirmed amount covers the invoice
		if (typeof p.amountRub === 'number' && Number.isFinite(p.amountRub) && p.amountRub + 0.5 < inv.totalRub) {
			inv.status = 'underpaid'; inv.meta.paidAmountRub = p.amountRub; save();
			console.warn(`[billing] underpaid invoice ${inv.id}: paid ${p.amountRub} < ${inv.totalRub}`);
			return { ok: false, status: 'underpaid' };
		}
		finalizeInvoice(inv.id);
		return { ok: true, status: 'paid' };
	}
	if (p.status === 'canceled' || p.status === 'chargeback') { inv.status = 'failed'; save(); return { ok: true, status: 'failed' }; }
	return { ok: true, status: 'pending' };
}

// Periodic sweep — settle/expire pending gateway invoices. Expires ones older
// than 30 min (Platega links live ~15 min).
export async function reconcilePendingInvoices() {
	const now = Date.now();
	let settled = 0, expired = 0;
	for (const inv of db().invoices) {
		if (inv.status !== 'pending' || inv.method !== 'card' || !inv.meta?.paymentId) { continue; }
		const r = await reconcileInvoice(inv.id);
		if (r.status === 'paid') { settled++; }
		else if (now - inv.ts > 30 * 60_000) { inv.status = 'expired'; save(); expired++; }
	}
	return { settled, expired };
}

// ---- unified order entry ---------------------------------------------------

// Build a charge. method 'balance' → instant; 'card' → pending gateway payment.
// Returns instant { ok, paid, user, charged, invoice } OR pending { ok, pending,
// confirmationUrl, invoiceId, due }.
async function startOrder(user, { kind, items, effects, method, description }) {
	const due = Math.max(0, lineSum(items));

	// nothing to pay (fully discounted) → grant immediately
	if (due <= 0) {
		const inv = newInvoice(user.id, kind, items, { method: 'free', promo: effects?.promo || null, status: 'paid' });
		inv.meta.effects = effects; applyOrderEffects(user.id, effects, inv.id); ledgerPurchase(inv); save();
		return { ok: true, paid: true, user: publicUser(getUser(user.id)), charged: 0, method: 'free', invoice: inv };
	}

	if (method === 'balance') {
		if ((user.balanceRub || 0) + 1e-9 < due) { return { ok: false, error: 'insufficient_balance' }; }
		adjustBalance(user.id, -due, 'purchase');
		const inv = newInvoice(user.id, kind, items, { method: 'balance', promo: effects?.promo || null, status: 'paid', meta: { effects } });
		applyOrderEffects(user.id, effects, inv.id); ledgerPurchase(inv); save();
		return { ok: true, paid: true, user: publicUser(getUser(user.id)), charged: due, method: 'balance', invoice: inv };
	}

	// card → real gateway
	if (!paymentsEnabled()) { return { ok: false, error: 'payments_not_configured' }; }
	const inv = newInvoice(user.id, kind, items, { method: 'card', promo: effects?.promo || null, status: 'pending', meta: { effects } });
	const pay = await createPayment({ amountRub: due, description: description || kind, metadata: { invoiceId: inv.id }, returnUrl: returnUrl() });
	if (!pay.ok) {
		inv.status = 'failed'; inv.meta.error = pay.error; save();
		return { ok: false, error: pay.error, detail: pay.detail };
	}
	inv.meta.paymentId = pay.id; save();
	return { ok: true, pending: true, confirmationUrl: pay.confirmationUrl, invoiceId: inv.id, due };
}

// ---- proration -------------------------------------------------------------

function remainingValue(user) {
	const cur = planOf(user.plan);
	if (!isPaidTier(user.plan) || !user.planExpiresAt || user.planExpiresAt <= Date.now()) { return 0; }
	const periodMs = (cur.periodDays || 30) * 86400000;
	const frac = Math.max(0, Math.min(1, (user.planExpiresAt - Date.now()) / periodMs));
	return Math.floor((cur.priceRub || 0) * frac);
}

export function upgradePreview(userId, planId, annual = false) {
	const user = getUser(userId);
	if (!user || !PURCHASABLE.includes(planId)) { return { ok: false, error: 'bad_request' }; }
	const base = annual ? annualPrice(planId) : planOf(planId).priceRub;
	const proration = Math.min(base, remainingValue(user));
	return { ok: true, base, prorationCredit: proration, dueNow: Math.max(0, base - proration) };
}

// ---- public purchase flows -------------------------------------------------

export async function checkout(userId, planId, { promoCode = null, method = 'card', annual = false } = {}) {
	if (!PURCHASABLE.includes(planId)) { return { ok: false, error: 'not_purchasable' }; }
	const user = getUser(userId);
	if (!user) { return { ok: false, error: 'no_user' }; }
	const plan = planOf(planId);
	const base = annual ? annualPrice(planId) : plan.priceRub;
	const items = [{ label: `${plan.label}${annual ? ' · год' : ' · месяц'}`, amountRub: base, qty: 1 }];

	const proration = Math.min(base, remainingValue(user));
	if (proration > 0) { items.push({ label: `Зачёт остатка ${planOf(user.plan).label}`, amountRub: -proration, qty: 1 }); }

	let promo = null;
	if (promoCode) {
		const ev = evalPromo(promoCode, 'plan', base);
		if (!ev.ok) { return { ok: false, error: 'promo_' + ev.error, promo_error: ev.error }; }
		promo = ev.promo.code;
		items.push({ label: `Промокод ${promo} (${ev.label})`, amountRub: -ev.discountRub, qty: 1 });
	}
	const days = annual ? 365 : plan.periodDays;
	const r = await startOrder(user, { kind: 'plan', items, effects: { plan: { id: planId, days }, promo }, method, description: `Xipher ${plan.label}` });
	if (promo && (r.paid || r.pending)) { consumePromo(promo); }
	return r;
}

export async function buyCredits(userId, packId, { promoCode = null, method = 'card' } = {}) {
	const user = getUser(userId);
	if (!user) { return { ok: false, error: 'no_user' }; }
	const pack = creditPack(packId);
	if (!pack) { return { ok: false, error: 'no_pack' }; }
	const items = [{ label: `Пакет кредитов «${pack.label}» (+${pack.credits})`, amountRub: pack.priceRub, qty: 1 }];
	let promo = null;
	if (promoCode) {
		const ev = evalPromo(promoCode, 'credits', pack.priceRub);
		if (!ev.ok) { return { ok: false, error: 'promo_' + ev.error, promo_error: ev.error }; }
		promo = ev.promo.code;
		items.push({ label: `Промокод ${promo} (${ev.label})`, amountRub: -ev.discountRub, qty: 1 });
	}
	const r = await startOrder(user, { kind: 'credits', items, effects: { credits: pack.credits, promo }, method, description: `Кредиты ${pack.label}` });
	if (promo && (r.paid || r.pending)) { consumePromo(promo); }
	return r;
}

// Top-up always uses the card gateway (it's the money coming in). Promo → bonus.
export async function topUp(userId, amountRub, method = 'card', promoCode = null) {
	const user = getUser(userId);
	if (!user) { return { ok: false, error: 'no_user' }; }
	amountRub = Math.floor(Number(amountRub));
	if (!(amountRub >= TOPUP_MIN && amountRub <= TOPUP_MAX)) { return { ok: false, error: 'bad_amount', min: TOPUP_MIN, max: TOPUP_MAX }; }
	let promo = null, credited = amountRub;
	const items = [{ label: 'Пополнение кошелька', amountRub, qty: 1 }];
	if (promoCode) {
		const ev = evalPromo(promoCode, 'topup', amountRub);
		if (!ev.ok) { return { ok: false, error: 'promo_' + ev.error, promo_error: ev.error }; }
		promo = ev.promo.code; credited = amountRub + ev.discountRub;
		items.push({ label: `Бонус ${promo} (+${ev.discountRub} ₽)`, amountRub: 0, qty: 1 });
	}
	const r = await startOrder(user, { kind: 'topup', items, effects: { balanceRub: credited, promo }, method: 'card', description: 'Пополнение кошелька Xipher' });
	if (promo && (r.paid || r.pending)) { consumePromo(promo); }
	return r;
}

// Referral trial (49₽) — real payment; grants trial + rewards inviter on success.
export async function purchaseReferralTrial(user, rec, owner, method = 'card') {
	const items = [{ label: `Pro на ${PLANS.trial.periodDays} дней (реф ${rec.code})`, amountRub: PLANS.trial.priceRub, qty: 1 }];
	const effects = { plan: { id: 'trial', days: PLANS.trial.periodDays }, referral: { code: rec.code, ownerId: owner.id, redeemerId: user.id }, ref: rec.code };
	return startOrder(user, { kind: 'referral_trial', items, effects, method, description: `Xipher Pro trial (${rec.code})` });
}

// ---- subscription controls -------------------------------------------------

export function cancelSubscription(userId) {
	const u = getUser(userId);
	if (!u) { return { ok: false, error: 'no_user' }; }
	if (!isPaidTier(u.plan)) { return { ok: false, error: 'not_subscribed' }; }
	u.autoRenew = false; save();
	return { ok: true, user: publicUser(getUser(userId)), endsAt: u.planExpiresAt };
}

export function processRenewals() {
	const now = Date.now();
	let renewed = 0, lapsed = 0;
	for (const u of Object.values(db().users)) {
		if (!isPaidTier(u.plan) || u.plan === 'trial') { continue; }
		if (!u.planExpiresAt || u.planExpiresAt > now) { continue; }
		const plan = planOf(u.plan);
		if (u.autoRenew && (u.balanceRub || 0) >= plan.priceRub) {
			adjustBalance(u.id, -plan.priceRub, 'auto-renew');
			setPlan(u.id, u.plan, { days: plan.periodDays });
			const inv = newInvoice(u.id, 'renewal', [{ label: `Автопродление ${plan.label}`, amountRub: plan.priceRub, qty: 1 }], { method: 'balance', status: 'paid', meta: { effects: { plan: { id: u.plan, days: plan.periodDays } } } });
			ledgerPurchase(inv);
			renewed++;
		} else {
			u.plan = 'free'; u.planExpiresAt = null; save();
			lapsed++;
		}
	}
	return { renewed, lapsed };
}

// ---- refunds (admin) -------------------------------------------------------

export function refund(invoiceId, { revokePlan = false } = {}) {
	const inv = invoiceById(invoiceId);
	if (!inv) { return { ok: false, error: 'no_invoice' }; }
	if (inv.status !== 'paid') { return { ok: false, error: 'not_refundable' }; }
	inv.status = 'refunded'; inv.refundedAt = Date.now();
	adjustBalance(inv.userId, inv.totalRub, 'refund', inv.id);
	if (inv.kind === 'credits' && inv.meta?.effects?.credits) { addBonusCredits(inv.userId, -inv.meta.effects.credits); }
	if (inv.kind === 'plan' && revokePlan) { setPlan(inv.userId, 'free'); }
	db().purchases.push({ id: 'ref_' + inv.id, userId: inv.userId, plan: null, priceRub: -inv.totalRub, kind: 'refund', ref: inv.id, ts: Date.now() });
	save();
	return { ok: true, invoice: inv };
}

export function rewardReferrer(ownerId, ref) {
	adjustBalance(ownerId, REFERRAL_REWARD_RUB, 'referral_reward', ref);
	addReferralEarnings(ownerId, REFERRAL_REWARD_RUB);
	return REFERRAL_REWARD_RUB;
}

// ---- analytics -------------------------------------------------------------

export function revenueStats() {
	const purchases = db().purchases;
	let total = 0; const byKind = {}, byPlan = {};
	for (const p of purchases) {
		total += p.priceRub;
		byKind[p.kind] = (byKind[p.kind] || 0) + p.priceRub;
		if (p.plan) { byPlan[p.plan] = (byPlan[p.plan] || 0) + p.priceRub; }
	}
	return { totalRub: total, count: purchases.length, byKind, byPlan };
}

export function billingMetrics() {
	const users = Object.values(db().users);
	const now = Date.now();
	let mrr = 0, activePaid = 0, walletLiability = 0, bonusCreditsOut = 0;
	for (const u of users) {
		walletLiability += u.balanceRub || 0;
		bonusCreditsOut += u.bonusCredits || 0;
		if (isPaidTier(u.plan) && u.plan !== 'trial' && u.planExpiresAt && u.planExpiresAt > now) { activePaid++; mrr += planOf(u.plan).priceRub; }
	}
	const invoices = db().invoices;
	const paid = invoices.filter(i => i.status === 'paid');
	const grossRub = paid.reduce((s, i) => s + i.totalRub, 0);
	const refundedRub = invoices.filter(i => i.status === 'refunded').reduce((s, i) => s + i.totalRub, 0);
	const pending = invoices.filter(i => i.status === 'pending').length;
	return {
		mrr: Math.round(mrr), arr: Math.round(mrr * 12), arpu: activePaid ? Math.round(mrr / activePaid) : 0,
		activePaid, users: users.length,
		grossRub, refundedRub, netRub: grossRub - refundedRub,
		walletLiabilityRub: Math.round(walletLiability), bonusCreditsOutstanding: bonusCreditsOut,
		invoiceCount: invoices.length, pendingInvoices: pending,
		paymentsEnabled: paymentsEnabled(),
		...revenueStats(),
	};
}

export { PLANS };
