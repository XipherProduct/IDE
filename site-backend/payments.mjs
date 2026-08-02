// Real payment gateway — Platega (platega.io). A card/SBP purchase creates a real
// transaction; the payer is redirected to Platega; confirmation comes via (a) the
// return-page status reconciliation (primary — works even though the merchant's
// global callback URL points at another service) and (b) an optional webhook.
//
// Env: PLATEGA_MERCHANT_ID + PLATEGA_SECRET (+ PLATEGA_BASE, default app.platega.io).
// A test stub (PAYMENTS_TEST_STUB=1) is provided ONLY for the test suite.

import crypto from 'node:crypto';

const MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || '';
const SECRET = process.env.PLATEGA_SECRET || '';
const BASE = (process.env.PLATEGA_BASE || 'https://app.platega.io').replace(/\/$/, '');
const TEST_STUB = process.env.PAYMENTS_TEST_STUB === '1';

const stub = new Map(); // test-only: transactionId -> record

export function paymentsEnabled() { return TEST_STUB || !!(MERCHANT_ID && SECRET); }
export function paymentsProvider() { return TEST_STUB ? 'stub' : (paymentsEnabled() ? 'platega' : null); }

function headers() { return { 'X-MerchantId': MERCHANT_ID, 'X-Secret': SECRET, 'Content-Type': 'application/json' }; }

// Verify an inbound callback proves it's Platega by echoing our secret.
export function verifyCallbackAuth(reqHeaders) {
	const sec = reqHeaders['x-secret'] || '';
	const mid = reqHeaders['x-merchantid'] || '';
	if (!SECRET || !MERCHANT_ID) { return false; }
	const okSec = sec.length === SECRET.length && crypto.timingSafeEqual(Buffer.from(sec), Buffer.from(SECRET));
	const okMid = mid.length === MERCHANT_ID.length && crypto.timingSafeEqual(Buffer.from(mid), Buffer.from(MERCHANT_ID));
	return okSec && okMid;
}

// Map Platega status → our internal status.
function mapStatus(s) {
	switch (s) {
		case 'CONFIRMED': return 'succeeded';
		case 'CANCELED': return 'canceled';
		case 'CHARGEBACKED': return 'chargeback';
		default: return 'pending';
	}
}

// Create a transaction (no fixed method — payer picks on Platega's page).
// Returns { ok, id, confirmationUrl, status } or { ok:false, error }.
export async function createPayment({ amountRub, description, metadata, returnUrl }) {
	if (!paymentsEnabled()) { return { ok: false, error: 'payments_not_configured' }; }
	if (!(amountRub > 0)) { return { ok: false, error: 'bad_amount' }; }
	const payload = String(metadata?.invoiceId || '');

	if (TEST_STUB) {
		const id = 'stub_' + crypto.randomBytes(8).toString('hex');
		stub.set(id, { id, status: 'PENDING', amountRub, payload });
		return { ok: true, id, confirmationUrl: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}stub_pay=${id}`, status: 'pending' };
	}

	try {
		const r = await fetch(`${BASE}/v2/transaction/process`, {
			method: 'POST',
			headers: headers(),
			body: JSON.stringify({
				paymentDetails: { amount: amountRub, currency: 'RUB' },
				description: (description || 'Xipher').slice(0, 128),
				return: returnUrl,
				failedUrl: returnUrl,
				payload,
				metadata: metadata || {},
			}),
		});
		const j = await r.json().catch(() => ({}));
		if (!r.ok || !j.url) { return { ok: false, error: 'gateway_error', detail: j?.message || j?.error || r.status }; }
		return { ok: true, id: j.transactionId, confirmationUrl: j.url, status: mapStatus(j.status) };
	} catch (e) {
		return { ok: false, error: 'gateway_unreachable', detail: String(e && e.message || e) };
	}
}

// Authoritative status — re-fetch from Platega. { ok, status, payload, amountRub }.
export async function fetchPayment(id) {
	if (TEST_STUB) {
		const p = stub.get(id);
		if (!p) { return { ok: false, error: 'not_found' }; }
		return { ok: true, status: mapStatus(p.status), payload: p.payload, amountRub: p.amountRub };
	}
	if (!paymentsEnabled()) { return { ok: false, error: 'payments_not_configured' }; }
	try {
		const r = await fetch(`${BASE}/transaction/${encodeURIComponent(id)}`, { headers: headers() });
		const j = await r.json().catch(() => ({}));
		if (!r.ok) { return { ok: false, error: 'gateway_error' }; }
		return { ok: true, status: mapStatus(j.status), payload: j.payload, amountRub: Number(j.paymentDetails?.amount) };
	} catch (e) {
		return { ok: false, error: 'gateway_unreachable' };
	}
}

// Test-only: mark a stubbed transaction CONFIRMED (simulates the payer paying).
// Optional amountRub overrides the gateway-reported amount (to test underpayment).
export function __stubSucceed(id, amountRub) {
	if (!TEST_STUB) { return false; }
	const p = stub.get(id);
	if (!p) { return false; }
	p.status = 'CONFIRMED';
	if (typeof amountRub === 'number') { p.amountRub = amountRub; }
	return true;
}
