// "Sign in with Google" — OAuth authorization-code flow, redirect style.
// We send the user to Google, Google returns to redirectUri (the site root) with
// ?code=&state=, and the app exchanges the code via the backend on load.

const STATE_KEY = 'xipher.googleState';
const RU_KEY = 'xipher.googleRedirectUri';

export function startGoogleLogin(cfg: { clientId: string; redirectUri: string; scope: string }) {
	const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	localStorage.setItem(STATE_KEY, state);
	localStorage.setItem(RU_KEY, cfg.redirectUri);
	const p = new URLSearchParams({
		client_id: cfg.clientId,
		redirect_uri: cfg.redirectUri,
		response_type: 'code',
		scope: cfg.scope || 'openid email profile',
		state,
		prompt: 'select_account',
		include_granted_scopes: 'true',
	});
	window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}

// On load: if we came back from Google (?code=&state=), return {code, redirectUri}
// after validating state. Clears the query from the URL. Returns null otherwise.
export function consumeGoogleRedirect(): { code: string; redirectUri: string } | null {
	const q = new URLSearchParams(window.location.search);
	const code = q.get('code');
	const state = q.get('state');
	if (!code) { return null; }
	const saved = localStorage.getItem(STATE_KEY);
	const redirectUri = localStorage.getItem(RU_KEY) || (window.location.origin + '/');
	// scrub the query so a refresh doesn't re-trigger
	window.history.replaceState({}, '', window.location.pathname + window.location.hash);
	localStorage.removeItem(STATE_KEY); localStorage.removeItem(RU_KEY);
	if (!saved || saved !== state) { return null; } // CSRF guard
	return { code, redirectUri };
}
