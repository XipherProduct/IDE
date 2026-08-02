// End-to-end smoke test. Boots the server (with the payment gateway in TEST STUB
// mode) against a temp DATA_DIR and drives the full flow via HTTP, including the
// pending → webhook → grant path for card payments.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'site-be-'));
const PORT = 8399;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_TOKEN = 'test-admin-token';

let pass = 0, fail = 0;
const check = (name, cond, info = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${info}`); } };

async function api(method, p, body, token) {
	const r = await fetch(BASE + p, {
		method,
		headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	let j = null; try { j = await r.json(); } catch {}
	return { status: r.status, j };
}
// Complete a card purchase: if the response is pending, drive the stub gateway.
async function settle(r, token) {
	if (r.j?.pending) { await api('POST', '/xapi/billing/_stub-complete', { invoiceId: r.j.invoiceId }, token); }
	return r;
}
const me = async (tok) => (await api('GET', '/xapi/me', null, tok)).j;
// Register + confirm email (MAIL_MODE=log returns devVerifyToken) → returns a session.
async function reg(email, password = 'hunter2secret') {
	const r = await api('POST', '/xapi/auth/register', { email, password });
	if (!r.j || !r.j.devVerifyToken) { return { ok: false, r }; }
	const v = await api('POST', '/xapi/auth/verify', { token: r.j.devVerifyToken });
	return { ok: v.status === 200, token: v.j.token, user: v.j.user, reg: r, verify: v };
}

const srv = spawn(process.execPath, ['server.mjs'], {
	cwd: import.meta.dirname,
	env: { ...process.env, PORT: String(PORT), DATA_DIR, ADMIN_TOKEN, PUBLIC_BASE: 'http://localhost:5173', PAYMENTS_TEST_STUB: '1', PLATEGA_MERCHANT_ID: 'test-merch-id', PLATEGA_SECRET: 'test-secret-key', MAIL_MODE: 'log' },
	stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitUp() {
	for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + '/healthz'); if (r.ok) { return; } } catch {} await new Promise(r => setTimeout(r, 100)); }
	throw new Error('server did not start');
}

try {
	await waitUp();

	// pricing math
	const pricing = await api('GET', '/xapi/pricing');
	check('pricing lists 3 tiers', pricing.j.plans.length === 3);
	check('Pro 999 / Max×5 4245 / Max×20 15984',
		pricing.j.plans.find(p => p.id === 'pro').priceRub === 999 &&
		pricing.j.plans.find(p => p.id === 'maxx5').priceRub === 4245 &&
		pricing.j.plans.find(p => p.id === 'maxx20').priceRub === 15984);

	// accounts
	const reg1 = await api('POST', '/xapi/auth/register', { email: 'alice@example.com', password: 'hunter2secret' });
	check('register → email verification required, NO session yet', reg1.status === 200 && reg1.j.emailVerificationRequired === true && !reg1.j.token);
	check('login BEFORE verify → 403 email_not_verified', (await api('POST', '/xapi/auth/login', { email: 'alice@example.com', password: 'hunter2secret' })).status === 403);
	const vAlice = await api('POST', '/xapi/auth/verify', { token: reg1.j.devVerifyToken });
	check('verify email → session + free plan', vAlice.status === 200 && !!vAlice.j.token && vAlice.j.user.plan === 'free');
	const aliceTok = vAlice.j.token;
	check('login AFTER verify → 200', (await api('POST', '/xapi/auth/login', { email: 'alice@example.com', password: 'hunter2secret' })).status === 200);
	check('bad verify token → 400', (await api('POST', '/xapi/auth/verify', { token: 'nope' })).status === 400);
	check('weak password → 400', (await api('POST', '/xapi/auth/register', { email: 'w@e.com', password: 'short' })).status === 400);
	check('duplicate email → 409', (await api('POST', '/xapi/auth/register', { email: 'alice@example.com', password: 'hunter2secret' })).status === 409);
	check('free user referral not eligible', (await api('GET', '/xapi/referral', null, aliceTok)).j.eligible === false);

	// alice buys Pro by CARD → pending → webhook grants
	const buy = await api('POST', '/xapi/billing/checkout', { plan: 'pro' }, aliceTok);
	check('card checkout returns pending + confirmationUrl', buy.j.pending === true && !!buy.j.confirmationUrl && !!buy.j.invoiceId, JSON.stringify(buy.j).slice(0, 120));
	check('plan NOT granted before payment settles', (await me(aliceTok)).user.plan === 'free');
	await settle(buy, aliceTok);
	check('plan granted after gateway confirms', (await me(aliceTok)).user.plan === 'pro');

	// referral now eligible
	const ref1 = await api('GET', '/xapi/referral', null, aliceTok);
	check('paid user referral eligible', ref1.j.eligible === true);
	const code = ref1.j.code;

	// bob redeems by CARD → pending → grant + inviter reward
	const bobTok = (await reg('bob@example.com')).token;
	check('referral preview valid (49₽/7d)', (await api('GET', `/xapi/referral/${code}`)).j.priceRub === 49);
	const redeem = await api('POST', `/xapi/referral/${code}/redeem`, {}, bobTok);
	check('redeem returns pending', redeem.j.pending === true);
	check('trial NOT granted before payment', (await me(bobTok)).user.plan === 'free');
	await settle(redeem, bobTok);
	check('bob is trial after payment', (await me(bobTok)).user.plan === 'trial');
	check('inviter rewarded +25₽ after settle', (await me(aliceTok)).user.balanceRub === 25);
	check('double redeem blocked', (await api('POST', `/xapi/referral/${code}/redeem`, {}, bobTok)).status === 400);
	check('self/already-paid redeem blocked', (await api('POST', `/xapi/referral/${code}/redeem`, {}, aliceTok)).status === 400);

	check('unauth /me → 401', (await api('GET', '/xapi/me')).status === 401);
	check('admin without token → 403', (await api('GET', '/xapi/admin/overview')).status === 403);
	const adm = await api('GET', '/xapi/admin/overview', null, ADMIN_TOKEN);
	check('admin overview', adm.status === 200 && adm.j.userCount >= 2);
	check('revenue = Pro 999 + trial 49 = 1048', adm.j.revenue.totalRub === 1048, `${adm.j.revenue.totalRub}`);
	check('admin set bob → maxx20', (await api('POST', '/xapi/admin/user-plan', { email: 'bob@example.com', plan: 'maxx20' }, ADMIN_TOKEN)).j.user.plan === 'maxx20');
	check('me usage windows (Pro week=2000)', (await me(aliceTok)).usage.creditsWeek_limit === 2000);

	// ---- expanded billing ----
	const cat = await api('GET', '/xapi/billing/catalog');
	check('catalog: annual 9590, 4 packs, presets, paymentsEnabled', cat.j.plans.find(p => p.id === 'pro').annualRub === 9590 && cat.j.creditPacks.length === 4 && cat.j.topupPresets.length > 0 && cat.j.paymentsEnabled === true);

	// top-up by card → settle → balance 25 + 1000 = 1025
	await settle(await api('POST', '/xapi/billing/topup', { amountRub: 1000 }, aliceTok), aliceTok);
	check('topup settles → balance 1025', (await me(aliceTok)).user.balanceRub === 1025, `${(await me(aliceTok)).user.balanceRub}`);

	// buy credits FROM WALLET (instant) → +1500 cr, balance 1025-649=376
	const packs = await api('POST', '/xapi/billing/credits', { packId: 'cr_m', method: 'balance' }, aliceTok);
	check('buy cr_m from wallet instant', packs.j.paid === true && packs.j.charged === 649);
	const am = await me(aliceTok);
	check('bonus +1500, balance 376, effective week 3500', am.user.bonusCredits === 1500 && am.user.balanceRub === 376 && am.usage.creditsWeek_effective_limit === 3500, `${am.user.bonusCredits}/${am.user.balanceRub}/${am.usage.creditsWeek_effective_limit}`);

	// insufficient balance rejected
	check('buy from wallet w/ low balance → 400', (await api('POST', '/xapi/billing/checkout', { plan: 'maxx20', method: 'balance' }, aliceTok)).status === 400);

	// promo create + preview + apply via card
	check('admin create SAVE50', (await api('POST', '/xapi/admin/promo', { code: 'SAVE50', kind: 'percent', value: 50, appliesTo: 'plan' }, ADMIN_TOKEN)).j.ok);
	check('promo preview 50% of 4245 → 2122', (await api('POST', '/xapi/billing/promo/preview', { code: 'SAVE50', target: 'plan', baseRub: 4245 }, aliceTok)).j.discountRub === 2122);
	const carolTok = (await reg('carol@example.com')).token;
	const buyC = await api('POST', '/xapi/billing/checkout', { plan: 'maxx5', promoCode: 'SAVE50' }, carolTok);
	check('maxx5 w/ SAVE50 → due 2123 pending', buyC.j.pending === true && buyC.j.due === 2123, `${buyC.j.due}`);
	await settle(buyC, carolTok);
	check('carol maxx5 after settle', (await me(carolTok)).user.plan === 'maxx5');

	// upgrade proration
	const upPrev = await api('GET', '/xapi/billing/upgrade-preview?plan=maxx20', null, carolTok);
	check('upgrade preview proration', upPrev.j.ok && upPrev.j.prorationCredit > 0 && upPrev.j.dueNow < upPrev.j.base);

	// annual
	const daveTok = (await reg('dave@example.com')).token;
	const ann = await api('POST', '/xapi/billing/checkout', { plan: 'pro', annual: true }, daveTok);
	check('annual due 9590', ann.j.due === 9590);
	await settle(ann, daveTok);
	check('dave Pro annual (365d)', (await me(daveTok)).user.plan === 'pro');

	// invoices + receipts
	const inv = await api('GET', '/xapi/billing/invoices', null, carolTok);
	const invId = inv.j.invoices[0].id;
	check('carol invoice w/ line items', inv.j.invoices.length >= 1 && inv.j.invoices[0].items.length >= 1);
	check('receipt own', (await api('GET', `/xapi/billing/invoice/${invId}/receipt`, null, carolTok)).status === 200);
	check('receipt others → 404', (await api('GET', `/xapi/billing/invoice/${invId}/receipt`, null, daveTok)).status === 404);

	// auto-renew / cancel
	check('auto-renew off', (await api('POST', '/xapi/billing/auto-renew', { on: false }, carolTok)).j.autoRenew === false);
	check('cancel subscription', (await api('POST', '/xapi/billing/cancel', {}, carolTok)).j.ok === true);

	// admin grant + refund
	const grant = await api('POST', '/xapi/admin/grant', { email: 'dave@example.com', credits: 1000, balanceRub: 500 }, ADMIN_TOKEN);
	check('admin grant 1000cr + 500₽', grant.j.user.bonusCredits === 1000 && grant.j.user.balanceRub === 500);
	check('refund carol plan invoice', (await api('POST', '/xapi/admin/refund', { invoiceId: invId }, ADMIN_TOKEN)).j.invoice.status === 'refunded');
	check('refund → carol wallet 2123', (await me(carolTok)).user.balanceRub === 2123, `${(await me(carolTok)).user.balanceRub}`);

	// metrics
	const m = await api('GET', '/xapi/admin/metrics', null, ADMIN_TOKEN);
	check('metrics MRR/ARR/ARPU + paymentsEnabled', m.j.mrr > 0 && m.j.arr === m.j.mrr * 12 && m.j.activePaid >= 1 && m.j.paymentsEnabled === true, `mrr=${m.j.mrr}`);
	check('metrics net revenue tracked (>0)', m.j.netRub > 0 && typeof m.j.walletLiabilityRub === 'number');
	check('promo list + redemptions', (await api('GET', '/xapi/admin/promos', null, ADMIN_TOKEN)).j.stats.redemptions >= 1);

	// ---- webhook security (the "can't be bypassed" property) ----
	const MERCH = 'test-merch-id', SEC = 'test-secret-key';
	const webhook = (headers, body) => fetch(BASE + '/xapi/billing/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

	const eveTok = (await reg('eve@example.com')).token;
	const buyE = await api('POST', '/xapi/billing/checkout', { plan: 'pro' }, eveTok);
	check('eve checkout pending', buyE.j.pending === true);
	// forged webhook (no secret) claiming CONFIRMED → must NOT grant
	await webhook({}, { payload: buyE.j.invoiceId, status: 'CONFIRMED' });
	check('forged webhook (no secret) does NOT grant', (await me(eveTok)).user.plan === 'free');
	// even a correctly-authed webhook does NOT grant while the gateway still says pending
	await webhook({ 'X-MerchantId': MERCH, 'X-Secret': SEC }, { payload: buyE.j.invoiceId, status: 'CONFIRMED' });
	check('authed webhook does NOT grant until gateway confirms (body untrusted)', (await me(eveTok)).user.plan === 'free');
	// gateway confirms → authed webhook reconciles → grants
	await api('POST', '/xapi/billing/_stub-confirm', { invoiceId: buyE.j.invoiceId }, eveTok);
	await webhook({ 'X-MerchantId': MERCH, 'X-Secret': SEC }, { payload: buyE.j.invoiceId });
	check('authed webhook + gateway-confirmed → grants', (await me(eveTok)).user.plan === 'pro');

	// underpayment protection
	const frankTok = (await reg('frank@example.com')).token;
	const buyF = await api('POST', '/xapi/billing/checkout', { plan: 'pro' }, frankTok);
	await api('POST', '/xapi/billing/_stub-confirm', { invoiceId: buyF.j.invoiceId, amountRub: 1 }, frankTok); // gateway: paid only 1₽ of 999
	const st = await api('GET', `/xapi/billing/invoice/${buyF.j.invoiceId}/status`, null, frankTok);
	check('underpayment blocked (marked underpaid, not granted)', st.j.status === 'underpaid' && (await me(frankTok)).user.plan === 'free', st.j.status);

} catch (e) {
	console.error('TEST ERROR', e);
	fail++;
} finally {
	srv.kill('SIGKILL');
	fs.rmSync(DATA_DIR, { recursive: true, force: true });
	console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
	process.exit(fail ? 1 : 0);
}
