// Xipher site backend — accounts, tariffs, referrals, admin.
// Zero runtime deps (Node 20+ built-ins). Bearer-token sessions.

import http from 'node:http';
import { load, flush } from './db.mjs';
import { pricingCatalog, PURCHASABLE, creditPackCatalog, TOPUP_PRESETS, TOPUP_MIN, TOPUP_MAX } from './plans.mjs';
import {
	createUser, authenticate, createSession, sessionUser, revokeSession,
	publicUser, listUsers, setPlan, getUser, effectivePlan, findByEmail,
	setAutoRenew, adjustBalance, addBonusCredits, balanceLedger,
	isVerified, verifyEmailToken, regenVerifyToken, oauthUpsert,
	setAutoUpdate, getAutoUpdate,
} from './users.mjs';
import { sendVerificationEmail, mailMode } from './mailer.mjs';
import { googleConfig, exchangeCode } from './google.mjs';
import { usageSnapshot, activityByDay, canAfford, charge } from './usage.mjs';
import { referralInfo, referralPreview, redeemReferral, createCampaignReferral } from './referrals.mjs';
import {
	checkout, revenueStats, recentPurchases, topUp, buyCredits, upgradePreview,
	cancelSubscription, refund, processRenewals, billingMetrics,
	invoicesFor, invoiceById, invoiceByPaymentId, recentInvoices, finalizeInvoice,
	reconcileInvoice, reconcilePendingInvoices,
} from './billing.mjs';
import { paymentsEnabled, paymentsProvider, verifyCallbackAuth, __stubSucceed } from './payments.mjs';
import {
	createPromo, listPromos, setPromoActive, deletePromo, evalPromo, promoStats,
} from './promos.mjs';
import {
	isEmail, normEmail, passwordProblem, rateLimit, sweepRateLimiter, safeEqual,
} from './security.mjs';
import { serveStatic, hasPublic } from './static.mjs';
import { downloadsManifest, serveDownload } from './downloads.mjs';

const PORT = Number(process.env.PORT || 8098);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'http://localhost:5173';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Shared secret for backend↔backend calls (ide-backend uses this ledger for chat credits).
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
// ide-backend admin proxy: the site admin (isAdmin) surfaces the IDE / Web-Code
// fleet (models, tiers, executors, sessions, devices). The IDE admin token stays
// server-side here — the browser only ever holds its normal site session.
const IDE_BACKEND_URL = process.env.IDE_BACKEND_URL || 'http://127.0.0.1:8097';
const IDE_ADMIN_TOKEN = process.env.IDE_ADMIN_TOKEN || '';
async function ideAdmin(path, opts = {}) {
	if (!IDE_ADMIN_TOKEN) { return { ok: false, status: 503, body: { error: 'ide_admin_not_configured' } }; }
	try {
		const r = await fetch(`${IDE_BACKEND_URL}${path}`, {
			method: opts.method || 'GET',
			headers: { 'Authorization': `Bearer ${IDE_ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
			body: opts.body ? JSON.stringify(opts.body) : undefined,
		});
		const body = await r.json().catch(() => ({}));
		return { ok: r.ok, status: r.status, body };
	} catch (e) { return { ok: false, status: 502, body: { error: String(e && e.message || e) } }; }
}
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',');

// ---- http helpers ----------------------------------------------------------

function cors(req, res) {
	const origin = req.headers.origin;
	if (origin && ALLOW_ORIGINS.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Vary', 'Origin');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

function json(res, status, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
	res.end(body);
}

async function readJson(req, cap = 256 * 1024) {
	const chunks = [];
	let len = 0;
	for await (const c of req) {
		len += c.length;
		if (len > cap) { throw new Error('payload too large'); }
		chunks.push(c);
	}
	if (!chunks.length) { return {}; }
	try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

function bearer(req) {
	const h = req.headers['authorization'] || '';
	return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function clientIp(req) {
	return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function requireUser(req, res) {
	const u = sessionUser(bearer(req));
	if (!u) { json(res, 401, { error: 'unauthorized' }); return null; }
	return u;
}

function requireAdmin(req, res) {
	const tok = bearer(req);
	// admin via env token OR a logged-in admin user's session
	if (ADMIN_TOKEN && safeEqual(tok, ADMIN_TOKEN)) { return { id: 'env-admin', isAdmin: true, env: true }; }
	const u = sessionUser(tok);
	if (u && u.isAdmin) { return u; }
	json(res, 403, { error: 'forbidden' });
	return null;
}

// ---- handlers --------------------------------------------------------------

async function handleRegister(req, res) {
	const ip = clientIp(req);
	const rl = rateLimit(`reg:${ip}`, 8, 3600_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }

	const b = await readJson(req);
	const email = normEmail(b.email);
	if (!isEmail(email)) { return json(res, 400, { error: 'bad_email' }); }
	const pwErr = passwordProblem(b.password);
	if (pwErr) { return json(res, 400, { error: 'bad_password', message: pwErr }); }

	const r = createUser(email, b.password);
	if (!r.ok) { return json(res, 409, { error: r.error }); }
	// Send a verification email; do NOT issue a session until the email is confirmed
	// (this is the anti-farming gate — a real, deliverable inbox is required).
	const verifyUrl = `${PUBLIC_BASE.replace(/\/$/, '')}/#/verify/${r.user.verifyToken}`;
	await sendVerificationEmail(email, verifyUrl);
	const resp = { ok: true, emailVerificationRequired: true, email };
	if (mailMode() !== 'sendmail') { resp.devVerifyToken = r.user.verifyToken; } // dev/test only (never in prod)
	return json(res, 200, resp);
}

async function handleLogin(req, res) {
	const ip = clientIp(req);
	const rl = rateLimit(`login:${ip}`, 12, 900_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }

	const b = await readJson(req);
	const r = authenticate(b.email, b.password);
	if (!r.ok) { return json(res, 401, { error: 'bad_credentials' }); }
	if (!isVerified(r.user)) { return json(res, 403, { error: 'email_not_verified', email: r.user.email }); }
	const token = createSession(r.user.id, req.headers['user-agent']);
	return json(res, 200, { token, user: publicUser(r.user) });
}

async function handleVerify(req, res) {
	const b = await readJson(req);
	const r = verifyEmailToken(b.token);
	if (!r.ok) { return json(res, 400, r); }
	const token = createSession(r.user.id, req.headers['user-agent']); // auto-login on verify
	return json(res, 200, { ok: true, token, user: publicUser(r.user) });
}

async function handleResend(req, res) {
	const rl = rateLimit(`resend:${clientIp(req)}`, 5, 3600_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }
	const b = await readJson(req);
	const rg = regenVerifyToken(normEmail(b.email));
	if (rg) {
		const verifyUrl = `${PUBLIC_BASE.replace(/\/$/, '')}/#/verify/${rg.token}`;
		await sendVerificationEmail(rg.user.email, verifyUrl);
	}
	return json(res, 200, { ok: true }); // don't reveal whether the email exists
}

// Sign in with Google: the SPA sends the auth code, we exchange it for the
// verified identity and upsert the account (email already proven → no mail sent).
async function handleGoogleAuth(req, res) {
	const rl = rateLimit(`google:${clientIp(req)}`, 30, 900_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }
	const b = await readJson(req);
	const r = await exchangeCode(b.code, b.redirectUri);
	if (!r.ok) { return json(res, 400, r); }
	const u = oauthUpsert(r.email, r.name, 'google');
	const token = createSession(u.id, req.headers['user-agent']);
	return json(res, 200, { ok: true, token, user: publicUser(u) });
}

function handleMe(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const plan = effectivePlan(u);
	return json(res, 200, { user: publicUser(u), usage: usageSnapshot(u.id, plan) });
}

// Public: the currently-published IDE version + per-platform download URLs.
// Per-platform build version. IDE_VERSION is the "latest" advertised version;
// WIN_IDE_VERSION / LINUX_IDE_VERSION say which version the currently-hosted
// installer for that platform actually IS. A platform's auto-update URL is only
// offered when its hosted build matches the advertised version — otherwise a
// silent updater would install a stale build in a loop. Defaults keep behavior
// unchanged (== IDE_VERSION) when the envs are unset.
function handleVersion(_req, res) {
	const mf = downloadsManifest();
	const WIN_VERSION = process.env.WIN_IDE_VERSION || mf.version;
	const LINUX_VERSION = process.env.LINUX_IDE_VERSION || mf.version;
	const pick = os => { const it = mf.items.find(i => i.os === os && i.available && i.recommended) || mf.items.find(i => i.os === os && i.available); return it ? `https://ide.xipher.pro${it.url}` : null; };
	return json(res, 200, {
		version: mf.version,
		windows: WIN_VERSION === mf.version ? pick('windows') : null,
		linux: LINUX_VERSION === mf.version ? pick('linux') : null,
		download_page: 'https://ide.xipher.pro/#/download',
	});
}

// User sets their auto-update preference: off | notify | silent.
async function handleSetAutoUpdate(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	const r = setAutoUpdate(u.id, String(b.mode || ''));
	if (!r.ok) { return json(res, 400, { error: r.error }); }
	return json(res, 200, { ok: true, autoUpdate: r.autoUpdate });
}

// Internal (ide-backend): read a user's auto-update mode.
function handleInternalAutoUpdate(req, res, url) {
	const userId = url.searchParams.get('userId') || '';
	return json(res, 200, { autoUpdate: getAutoUpdate(userId) });
}

async function handleCheckout(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	if (!PURCHASABLE.includes(b.plan)) { return json(res, 400, { error: 'not_purchasable' }); }
	const r = await checkout(u.id, b.plan, { promoCode: b.promoCode || null, method: b.method === 'balance' ? 'balance' : 'card', annual: !!b.annual });
	if (!r.ok) { return json(res, 400, r); }
	return json(res, 200, r);
}

function handleBillingCatalog(_req, res) {
	return json(res, 200, { plans: pricingCatalog(), creditPacks: creditPackCatalog(), topupPresets: TOPUP_PRESETS, topupBounds: { min: TOPUP_MIN, max: TOPUP_MAX }, paymentsEnabled: paymentsEnabled() });
}

function handleUpgradePreview(req, res, url) {
	const u = requireUser(req, res); if (!u) { return; }
	const plan = url.searchParams.get('plan');
	const annual = url.searchParams.get('annual') === '1';
	const r = upgradePreview(u.id, plan, annual);
	return json(res, r.ok ? 200 : 400, r);
}

async function handleTopup(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const rl = rateLimit(`topup:${clientIp(req)}`, 20, 3600_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }
	const b = await readJson(req);
	const r = await topUp(u.id, b.amountRub, 'card', b.promoCode || null);
	return json(res, r.ok ? 200 : 400, r);
}

async function handleBuyCredits(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	const r = await buyCredits(u.id, b.packId, { promoCode: b.promoCode || null, method: b.method === 'balance' ? 'balance' : 'card' });
	return json(res, r.ok ? 200 : 400, r);
}

async function handlePromoPreview(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	const target = ['plan', 'credits', 'topup'].includes(b.target) ? b.target : 'any';
	const r = evalPromo(b.code, target, Number(b.baseRub) || 0);
	return json(res, 200, r);
}

function handleInvoices(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	return json(res, 200, { invoices: invoicesFor(u.id), ledger: balanceLedger(u.id), balanceRub: u.balanceRub || 0, bonusCredits: u.bonusCredits || 0 });
}

function handleReceipt(req, res, id) {
	const u = requireUser(req, res); if (!u) { return; }
	const inv = invoiceById(id);
	if (!inv || inv.userId !== u.id) { return json(res, 404, { error: 'not_found' }); }
	return json(res, 200, { invoice: inv, user: { email: u.email, name: u.name } });
}

async function handleAutoRenew(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	const on = setAutoRenew(u.id, !!b.on);
	return json(res, 200, { ok: true, autoRenew: on, user: publicUser(getUser(u.id)) });
}

function handleCancel(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	const r = cancelSubscription(u.id);
	return json(res, r.ok ? 200 : 400, r);
}

// ---- admin billing ---------------------------------------------------------

function handleAdminMetrics(_req, res) { return json(res, 200, billingMetrics()); }

// --- IDE / Web-Code admin (proxied to ide-backend, admin-token kept server-side) ---
// Create a marketing campaign code (redeem → Pro 7d @ 49₽ for any new user).
async function handleAdminCampaignCode(req, res) {
	const b = await readJson(req);
	const owner = findByEmail(b.ownerEmail);
	if (!owner) { return json(res, 404, { ok: false, error: 'owner_not_found' }); }
	const r = createCampaignReferral(b.code, owner);
	return json(res, r.ok ? 200 : 400, r);
}
async function handleAdminIde(_req, res) { const r = await ideAdmin('/api/admin/overview'); return json(res, r.status, r.body); }
async function handleAdminIdeExecRevoke(req, res) { const b = await readJson(req); const r = await ideAdmin('/api/admin/executor-revoke', { method: 'POST', body: { executorId: b.executorId } }); return json(res, r.status, r.body); }
async function handleAdminIdeApprove(req, res) { const b = await readJson(req); const r = await ideAdmin('/api/admin/approve', { method: 'POST', body: { user_code: b.user_code, userId: b.userId } }); return json(res, r.status, r.body); }
async function handleAdminIdeSetPlan(req, res) { const b = await readJson(req); const r = await ideAdmin('/api/admin/user-plan', { method: 'POST', body: { userId: b.userId, plan: b.plan } }); return json(res, r.status, r.body); }
function handleAdminInvoices(_req, res) { return json(res, 200, { invoices: recentInvoices(150) }); }

async function handleAdminRefund(req, res) {
	const b = await readJson(req);
	const r = refund(b.invoiceId, { revokePlan: !!b.revokePlan });
	return json(res, r.ok ? 200 : 400, r);
}

async function handleAdminGrant(req, res) {
	const b = await readJson(req);
	const u = findByEmail(b.email) || getUser(b.userId);
	if (!u) { return json(res, 404, { error: 'no_user' }); }
	const out = {};
	if (b.credits) { out.bonusCredits = addBonusCredits(u.id, Number(b.credits)); }
	if (b.balanceRub) { out.balanceRub = adjustBalance(u.id, Number(b.balanceRub), 'admin_grant'); }
	if (b.plan) { out.plan = setPlan(u.id, b.plan, { days: b.days })?.plan; }
	return json(res, 200, { ok: true, user: publicUser(getUser(u.id)), applied: out });
}

function handleAdminPromos(_req, res) { return json(res, 200, { promos: listPromos(), stats: promoStats() }); }

async function handleAdminCreatePromo(req, res) {
	const b = await readJson(req);
	const r = createPromo(b);
	return json(res, r.ok ? 200 : 400, r);
}

async function handleAdminTogglePromo(req, res) {
	const b = await readJson(req);
	const ok = setPromoActive(b.code, !!b.active);
	return json(res, ok ? 200 : 404, { ok });
}

// ---- internal: single chat-credit ledger (ide-backend → site) --------------

function requireInternal(req, res) {
	const tok = req.headers['x-internal-secret'] || '';
	// loopback-only: xpcore always sets X-Forwarded-For on public traffic, and only
	// same-box services reach 127.0.0.1:PORT directly (no XFF). Plus the secret.
	const viaProxy = !!req.headers['x-forwarded-for'];
	const remote = (req.socket && req.socket.remoteAddress) || '';
	const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
	if (viaProxy || !loopback || !INTERNAL_SECRET || !safeEqual(tok, INTERNAL_SECRET)) { json(res, 403, { error: 'forbidden' }); return false; }
	return true;
}

// Is this user allowed to spend `cost` credits right now? Returns the current
// plan too, so the IDE can gate models against the live account plan.
async function handleInternalAuthorize(req, res) {
	const b = await readJson(req);
	const u = getUser(b.userId);
	if (!u) { return json(res, 404, { ok: false, error: 'no_user' }); }
	const plan = effectivePlan(u);
	const r = canAfford(u.id, plan, Number(b.cost) || 1);
	if (!r.ok) { return json(res, 200, { ok: false, error: 'quota_exhausted', window: r.window, reset_in_s: r.reset_in_s, plan }); }
	return json(res, 200, { ok: true, plan, usage: usageSnapshot(u.id, plan) });
}

async function handleInternalCharge(req, res) {
	const b = await readJson(req);
	if (!getUser(b.userId)) { return json(res, 404, { ok: false, error: 'no_user' }); }
	charge(b.userId, Number(b.cost) || 1, b.model);
	return json(res, 200, { ok: true });
}

// Resolve a web (site) session bearer token to an identity, for the ide-backend's
// Web "Code" platform. Loopback + internal-secret gated (requireInternal). The
// token itself never leaves the same box; only { userId, plan, ... } comes back.
async function handleInternalSession(req, res) {
	const b = await readJson(req);
	const u = sessionUser(b.token);
	if (!u) { return json(res, 401, { ok: false, error: 'invalid_session' }); }
	return json(res, 200, { ok: true, userId: u.id, plan: effectivePlan(u), email: u.email, name: u.name });
}

function handleReferralMine(req, res) {
	const u = requireUser(req, res); if (!u) { return; }
	return json(res, 200, referralInfo(u, PUBLIC_BASE));
}

async function handleReferralRedeem(req, res, code) {
	const ip = clientIp(req);
	const rl = rateLimit(`redeem:${ip}`, 10, 3600_000);
	if (!rl.ok) { return json(res, 429, { error: 'rate_limited', retry_after_s: rl.retryAfterS }); }
	const u = requireUser(req, res); if (!u) { return; }
	const b = await readJson(req);
	const r = await redeemReferral(code, u, b.method === 'balance' ? 'balance' : 'card');
	if (!r.ok) { return json(res, 400, r); }
	return json(res, 200, r);
}

// ---- payment gateway webhook + return-page confirmation --------------------

// Platega callback (POST from the gateway). SECURITY MODEL: this endpoint is only a
// trigger — it grants nothing from its body. We (1) rate-limit, (2) require the
// gateway's X-Secret/X-MerchantId headers, then (3) reconcile the referenced invoice
// against Platega's authoritative status (server-to-server). A forged POST fails at
// (2); even if it passed, (3) re-checks the real status + amount, so it can't grant.
// Always returns 200 so Platega doesn't retry-storm.
async function handleWebhook(req, res) {
	const rl = rateLimit(`webhook:${clientIp(req)}`, 240, 60_000);
	if (!rl.ok) { return json(res, 429, { ok: false }); }
	const b = await readJson(req);
	if (!verifyCallbackAuth(req.headers)) {
		console.warn(`[webhook] rejected unauthenticated callback from ${clientIp(req)}`);
		return json(res, 200, { ok: true });
	}
	// resolve our invoice from payload (our invoiceId) or the Platega transaction id
	const inv = (b?.payload && invoiceById(b.payload)) || (b?.id && invoiceByPaymentId(b.id)) || null;
	if (inv) { await reconcileInvoice(inv.id); }
	return json(res, 200, { ok: true });
}

// The SPA polls this after returning from the gateway. Actively reconciles against
// Platega so payment confirms even if no webhook reaches this service.
async function handleInvoiceStatus(req, res, id) {
	const u = requireUser(req, res); if (!u) { return; }
	const inv = invoiceById(id);
	if (!inv || inv.userId !== u.id) { return json(res, 404, { error: 'not_found' }); }
	if (inv.status === 'pending') { await reconcileInvoice(inv.id); }
	const fresh = invoiceById(id);
	return json(res, 200, { id: fresh.id, status: fresh.status, kind: fresh.kind, totalRub: fresh.totalRub });
}

// Test-only (YOOKASSA_TEST_STUB=1): simulate the user completing a stub payment.
async function handleStubComplete(req, res) {
	if (paymentsProvider() !== 'stub') { return json(res, 404, { error: 'not_found' }); }
	const b = await readJson(req);
	const inv = invoiceById(b.invoiceId);
	if (!inv || !inv.meta?.paymentId) { return json(res, 404, { error: 'no_pending' }); }
	__stubSucceed(inv.meta.paymentId);
	const r = finalizeInvoice(inv.id);
	return json(res, r.ok ? 200 : 400, r);
}

// Test-only: mark the gateway tx CONFIRMED (optionally underpaying) WITHOUT
// finalizing — so the webhook/reconcile path can be exercised.
async function handleStubConfirm(req, res) {
	if (paymentsProvider() !== 'stub') { return json(res, 404, { error: 'not_found' }); }
	const b = await readJson(req);
	const inv = invoiceById(b.invoiceId);
	if (!inv || !inv.meta?.paymentId) { return json(res, 404, { error: 'no_pending' }); }
	__stubSucceed(inv.meta.paymentId, typeof b.amountRub === 'number' ? b.amountRub : undefined);
	return json(res, 200, { ok: true });
}

// ---- admin -----------------------------------------------------------------

function handleAdminOverview(req, res) {
	const users = listUsers();
	const revenue = revenueStats();
	const planCounts = {};
	for (const u of users) { planCounts[u.plan] = (planCounts[u.plan] || 0) + 1; }
	return json(res, 200, {
		users,
		userCount: users.length,
		planCounts,
		revenue,
		pricing: pricingCatalog(),
	});
}

async function handleAdminSetPlan(req, res) {
	const b = await readJson(req);
	const u = findByEmail(b.email) || getUser(b.userId);
	if (!u) { return json(res, 404, { error: 'no_user' }); }
	const profile = setPlan(u.id, b.plan, { days: b.days });
	if (!profile) { return json(res, 400, { error: 'bad_plan' }); }
	return json(res, 200, { ok: true, user: profile });
}

function handleAdminPurchases(req, res) {
	return json(res, 200, { purchases: recentPurchases(100), revenue: revenueStats() });
}

// ---- router ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
	sweepRateLimiter();
	cors(req, res);
	if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

	const url = new URL(req.url, 'http://x');
	const path = url.pathname;
	const method = req.method || 'GET';

	try {
		if (path === '/healthz') { return json(res, 200, { ok: true, tiers: PURCHASABLE }); }
		if (path === '/xapi/pricing' && method === 'GET') { return json(res, 200, { plans: pricingCatalog() }); }
		if (path === '/xapi/downloads' && method === 'GET') { return json(res, 200, downloadsManifest()); }

		// Streaming desktop-IDE distributables (Range-capable). Not under /xapi/ so
		// direct links / the browser download manager hit it cleanly.
		if (path.startsWith('/download/') && (method === 'GET' || method === 'HEAD')) {
			return void serveDownload(req, res, decodeURIComponent(path.slice('/download/'.length)));
		}

		if (path === '/xapi/auth/register' && method === 'POST') { return await handleRegister(req, res); }
		if (path === '/xapi/auth/login' && method === 'POST') { return await handleLogin(req, res); }
		if (path === '/xapi/auth/verify' && method === 'POST') { return await handleVerify(req, res); }
		if (path === '/xapi/auth/resend' && method === 'POST') { return await handleResend(req, res); }
		if (path === '/xapi/auth/google/config' && method === 'GET') { return json(res, 200, googleConfig()); }
		if (path === '/xapi/auth/google' && method === 'POST') { return await handleGoogleAuth(req, res); }
		if (path === '/xapi/auth/logout' && method === 'POST') { revokeSession(bearer(req)); return json(res, 200, { ok: true }); }
		if (path === '/xapi/me' && method === 'GET') { return handleMe(req, res); }
		if (path === '/xapi/me/activity' && method === 'GET') {
			const u = requireUser(req, res); if (!u) { return; }
			const days = Math.min(371, Math.max(30, Number(url.searchParams.get('days')) || 119));
			return json(res, 200, activityByDay(u.id, days));
		}

		if (path === '/xapi/version' && method === 'GET') { return handleVersion(req, res); }
		if (path === '/xapi/me/auto-update' && method === 'POST') { return await handleSetAutoUpdate(req, res); }

		if (path === '/xapi/billing/catalog' && method === 'GET') { return handleBillingCatalog(req, res); }
		if (path === '/xapi/billing/checkout' && method === 'POST') { return await handleCheckout(req, res); }
		if (path === '/xapi/billing/upgrade-preview' && method === 'GET') { return handleUpgradePreview(req, res, url); }
		if (path === '/xapi/billing/topup' && method === 'POST') { return await handleTopup(req, res); }
		if (path === '/xapi/billing/credits' && method === 'POST') { return await handleBuyCredits(req, res); }
		if (path === '/xapi/billing/promo/preview' && method === 'POST') { return await handlePromoPreview(req, res); }
		if (path === '/xapi/billing/invoices' && method === 'GET') { return handleInvoices(req, res); }
		if (path.startsWith('/xapi/billing/invoice/') && path.endsWith('/receipt') && method === 'GET') {
			return handleReceipt(req, res, path.slice('/xapi/billing/invoice/'.length, -('/receipt'.length)));
		}
		if (path === '/xapi/billing/auto-renew' && method === 'POST') { return await handleAutoRenew(req, res); }
		if (path === '/xapi/billing/cancel' && method === 'POST') { return handleCancel(req, res); }
		if (path === '/xapi/billing/webhook' && method === 'POST') { return await handleWebhook(req, res); }
		// Also accept the exact callback path configured in the Platega dashboard, so a
		// route for it (host cloud.xipher.pro/…/platega/webhook → xsite) lands here.
		if (path === '/api/v1/remote/payments/platega/webhook' && method === 'POST') { return await handleWebhook(req, res); }
		if (path === '/xapi/billing/_stub-complete' && method === 'POST') { return await handleStubComplete(req, res); }
		if (path === '/xapi/billing/_stub-confirm' && method === 'POST') { return await handleStubConfirm(req, res); }
		if (path.startsWith('/xapi/billing/invoice/') && path.endsWith('/status') && method === 'GET') {
			return await handleInvoiceStatus(req, res, path.slice('/xapi/billing/invoice/'.length, -('/status'.length)));
		}

		if (path === '/xapi/referral' && method === 'GET') { return handleReferralMine(req, res); }
		if (path.startsWith('/xapi/referral/') && path.endsWith('/redeem') && method === 'POST') {
			const code = path.slice('/xapi/referral/'.length, -('/redeem'.length));
			return await handleReferralRedeem(req, res, decodeURIComponent(code));
		}
		if (path.startsWith('/xapi/referral/') && method === 'GET') {
			const code = decodeURIComponent(path.slice('/xapi/referral/'.length));
			return json(res, 200, referralPreview(code));
		}

		// admin
		if (path === '/xapi/admin/overview' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return handleAdminOverview(req, res); }
		if (path === '/xapi/admin/user-plan' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminSetPlan(req, res); }
		if (path === '/xapi/admin/purchases' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return handleAdminPurchases(req, res); }
		if (path === '/xapi/admin/metrics' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return handleAdminMetrics(req, res); }
		if (path === '/xapi/admin/invoices' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return handleAdminInvoices(req, res); }
		if (path === '/xapi/admin/refund' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminRefund(req, res); }
		if (path === '/xapi/admin/grant' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminGrant(req, res); }
		if (path === '/xapi/admin/promos' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return handleAdminPromos(req, res); }
		if (path === '/xapi/admin/promo' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminCreatePromo(req, res); }
		if (path === '/xapi/admin/promo/toggle' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminTogglePromo(req, res); }
		if (path === '/xapi/admin/campaign-code' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminCampaignCode(req, res); }
		if (path === '/xapi/admin/ide' && method === 'GET') { if (!requireAdmin(req, res)) { return; } return await handleAdminIde(req, res); }
		if (path === '/xapi/admin/ide/executor-revoke' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminIdeExecRevoke(req, res); }
		if (path === '/xapi/admin/ide/approve' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminIdeApprove(req, res); }
		if (path === '/xapi/admin/ide/user-plan' && method === 'POST') { if (!requireAdmin(req, res)) { return; } return await handleAdminIdeSetPlan(req, res); }

		if (path === '/xapi/internal/auto-update' && method === 'GET') { if (!requireInternal(req, res)) { return; } return handleInternalAutoUpdate(req, res, url); }
		if (path === '/xapi/internal/authorize' && method === 'POST') { if (!requireInternal(req, res)) { return; } return await handleInternalAuthorize(req, res); }
		if (path === '/xapi/internal/charge' && method === 'POST') { if (!requireInternal(req, res)) { return; } return await handleInternalCharge(req, res); }
		if (path === '/xapi/internal/session' && method === 'POST') { if (!requireInternal(req, res)) { return; } return await handleInternalSession(req, res); }

		// Static SPA (built frontend under ./public) + SPA fallback. API 404s stay JSON.
		if (!path.startsWith('/xapi/') && serveStatic(req, res)) { return; }

		return json(res, 404, { error: 'not_found', path });
	} catch (e) {
		return json(res, 500, { error: 'server_error', message: String(e && e.message || e) });
	}
});

load();
// bootstrap: promote the email in ADMIN_EMAIL to admin on boot (if it exists)
if (process.env.ADMIN_EMAIL) {
	const a = findByEmail(process.env.ADMIN_EMAIL);
	if (a && !a.isAdmin) { a.isAdmin = true; flush(); console.log(`[site-backend] promoted ${a.email} to admin`); }
}
// Auto-renew sweep: renew expiring paid plans from wallet, else let them lapse.
setInterval(() => {
	try { const r = processRenewals(); if (r.renewed || r.lapsed) { console.log(`[site-backend] renewals: +${r.renewed} renewed, ${r.lapsed} lapsed`); } } catch (e) { console.error('[renewals]', e); }
}, 60 * 60 * 1000).unref();

// Reconcile pending gateway payments (catches payers who didn't return to the site
// and covers the case where the merchant's global callback URL points elsewhere).
if (paymentsEnabled()) {
	setInterval(() => {
		reconcilePendingInvoices()
			.then(r => { if (r.settled || r.expired) { console.log(`[site-backend] reconcile: +${r.settled} settled, ${r.expired} expired`); } })
			.catch(e => console.error('[reconcile]', e));
	}, 2 * 60 * 1000).unref();
}

server.listen(PORT, HOST, () => {
	console.log(`[site-backend] listening on http://${HOST}:${PORT}`);
});
