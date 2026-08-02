// "Sign in with Google" (OAuth 2.0 authorization-code flow). Solves email
// verification for Gmail/Workspace users without sending mail (the server IP is
// blacklisted for SMTP): Google itself proves the user owns the address.
//
// Env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (+ GOOGLE_REDIRECT_URI, default
// https://ide.xipher.pro/). Register that redirect URI in the Google Cloud
// console OAuth client. When creds are unset, googleEnabled() === false.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://ide.xipher.pro/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleEnabled() { return !!(CLIENT_ID && CLIENT_SECRET); }
export function googleConfig() {
	return { enabled: googleEnabled(), clientId: CLIENT_ID, redirectUri: REDIRECT_URI, scope: 'openid email profile' };
}

function decodeJwtPayload(jwt) {
	try {
		const part = String(jwt).split('.')[1];
		return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
	} catch { return null; }
}

// Exchange an auth code for the user's verified Google identity.
// Returns { ok, email, name, sub } or { ok:false, error }.
export async function exchangeCode(code, redirectUri) {
	if (!googleEnabled()) { return { ok: false, error: 'google_not_configured' }; }
	if (!code) { return { ok: false, error: 'no_code' }; }
	try {
		const r = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				redirect_uri: redirectUri || REDIRECT_URI,
				grant_type: 'authorization_code',
			}),
		});
		const j = await r.json().catch(() => ({}));
		if (!r.ok || !j.id_token) { return { ok: false, error: 'exchange_failed', detail: j.error_description || j.error || r.status }; }

		// The id_token came straight from Google's token endpoint over an
		// authenticated TLS channel (we sent our client_secret), so its claims are
		// trustworthy; still sanity-check aud/iss/exp/email_verified.
		const p = decodeJwtPayload(j.id_token);
		if (!p) { return { ok: false, error: 'bad_id_token' }; }
		if (p.aud !== CLIENT_ID) { return { ok: false, error: 'aud_mismatch' }; }
		if (!(p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com')) { return { ok: false, error: 'iss_mismatch' }; }
		if (p.exp && Date.now() / 1000 > p.exp + 60) { return { ok: false, error: 'expired' }; }
		if (!p.email) { return { ok: false, error: 'no_email' }; }
		if (p.email_verified === false) { return { ok: false, error: 'email_unverified_at_google' }; }

		return { ok: true, email: String(p.email).toLowerCase(), name: p.name || String(p.email).split('@')[0], sub: p.sub };
	} catch (e) {
		return { ok: false, error: 'google_unreachable', detail: String(e && e.message || e) };
	}
}
