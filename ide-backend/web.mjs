// Web tools backend: search + fetch, matching the rich client contract in the
// IDE (alaskaTools.ts). Zero external deps.
//
// Architecture:
//   • webSearch(query, opts, userId, planId) → { provider, hits[], cached, truncated, latency_ms, hit_count }
//     Multi-provider with automatic fallback: Brave (keyed) → Tavily (keyed) →
//     DuckDuckGo (keyless). Honors max_results / freshness / site_filter / provider.
//   • webFetch(url, opts, userId, planId) → { content, content_type, title, byte_count,
//     truncated, final_url, status_code, cached, latency_ms, fetched_at }
//     SSRF-safe, format-aware (markdown | html | text), real HTML→markdown extraction.
//   • Per-user daily quota (by plan) + in-memory caching (24h search / 1h fetch).
//
// Keys are read from env server-side only — nothing about providers or keys ever
// reaches the client, which only ever sees normalized hits/markdown.

import { webQuotaOf } from './plans.mjs';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';

const BRAVE_KEY = process.env.BRAVE_API_KEY || '';
const TAVILY_KEY = process.env.TAVILY_API_KEY || '';

const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const FETCH_CACHE_TTL = 60 * 60 * 1000;       // 1h
const FETCH_TIMEOUT_MS = 15000;
const SEARCH_TIMEOUT_MS = 12000;
const UA = 'XipherIDE/1.0 (+https://ide.xipher.pro)';

// ---- tiny TTL cache ---------------------------------------------------------

function makeCache(ttl, max = 500) {
	const m = new Map();
	return {
		get(key) {
			const e = m.get(key);
			if (!e) { return undefined; }
			if (Date.now() > e.expires) { m.delete(key); return undefined; }
			// LRU touch
			m.delete(key); m.set(key, e);
			return e.value;
		},
		set(key, value) {
			m.set(key, { value, expires: Date.now() + ttl });
			if (m.size > max) { m.delete(m.keys().next().value); }
		},
	};
}
const searchCache = makeCache(SEARCH_CACHE_TTL);
const fetchCache = makeCache(FETCH_CACHE_TTL);

// ---- per-user daily quota ---------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const quotaStore = new Map(); // userId -> { search: {count, day}, fetch: {count, day} }

function dayIndex() { return Math.floor(Date.now() / DAY); }

// Returns { ok, used, limit, reset_in_s }. Increments only when ok.
function checkAndBump(userId, kind, planId) {
	const limit = webQuotaOf(planId)[kind];
	const today = dayIndex();
	let u = quotaStore.get(userId);
	if (!u) { u = { search: { count: 0, day: today }, fetch: { count: 0, day: today } }; quotaStore.set(userId, u); }
	const slot = u[kind];
	if (slot.day !== today) { slot.day = today; slot.count = 0; }
	const resetInS = Math.ceil((((today + 1) * DAY) - Date.now()) / 1000);
	if (slot.count >= limit) { return { ok: false, used: slot.count, limit, reset_in_s: resetInS }; }
	slot.count++;
	return { ok: true, used: slot.count, limit, reset_in_s: resetInS };
}

// ---- SSRF guard -------------------------------------------------------------
//
// Two layers: a cheap name pre-check, then the real defense — resolve the host to
// its actual IPs, reject any that fall in a private/reserved range, and PIN the
// connection to a validated IP so a rebinding trick (public name that resolves to
// 127.0.0.1 between check and connect) can't slip through. Every redirect hop is
// re-validated the same way.

// Fast pre-check on the name (literal IPs + obvious internal names).
function isBlockedHost(hostname) {
	const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
	if (!h) { return true; }
	if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) { return true; }
	if (h === 'metadata.google.internal') { return true; }
	// literal IPv4/IPv6 → validate directly
	if (/^[0-9.]+$/.test(h) || h.includes(':')) { return isBlockedIp(h); }
	return false;
}

// True if an IP literal is in a private/reserved/link-local range.
function isBlockedIp(ip) {
	let s = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '');
	if (!s) { return true; }
	// IPv4-mapped IPv6 (::ffff:a.b.c.d) → validate the embedded v4
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
	if (mapped) { s = mapped[1]; }
	if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
		const p = s.split('.').map(Number);
		if (p.some(o => o < 0 || o > 255)) { return true; }
		const [a, b] = p;
		if (a === 0 || a === 10 || a === 127) { return true; }
		if (a === 169 && b === 254) { return true; }              // link-local (incl. 169.254.169.254)
		if (a === 172 && b >= 16 && b <= 31) { return true; }     // 172.16/12
		if (a === 192 && b === 168) { return true; }              // 192.168/16
		if (a === 100 && b >= 64 && b <= 127) { return true; }    // CGNAT 100.64/10
		if (a === 192 && b === 0 && p[2] === 0) { return true; }  // 192.0.0/24
		if (a === 198 && (b === 18 || b === 19)) { return true; } // benchmarking 198.18/15
		if (a >= 224) { return true; }                            // multicast + reserved (224/4, 240/4)
		return false;
	}
	// IPv6
	if (s === '::1' || s === '::') { return true; }
	if (s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd')) { return true; } // link-local + ULA
	if (s.startsWith('ff')) { return true; }                                              // multicast
	return false;
}

// Resolve a hostname to public IPs only. Returns { ips, family } or throws a
// tagged error (code 'blocked' | 'dns').
async function resolvePublicAddrs(hostname) {
	let addrs;
	try { addrs = await dns.lookup(hostname, { all: true, verbatim: true }); }
	catch (e) { const err = new Error(`DNS resolution failed: ${e.message}`); err.code = 'dns'; throw err; }
	const ok = addrs.filter(a => !isBlockedIp(a.address));
	if (!ok.length) { const err = new Error('host resolves only to private/reserved addresses'); err.code = 'blocked'; throw err; }
	return ok;
}

// Fetch text with DNS pinning + per-hop SSRF revalidation. Returns
// { statusCode, headers, finalUrl, body } or throws a tagged error
// (code 'blocked' | 'dns' | 'timeout' | 'unsupported' | 'error').
async function fetchPinned(rawUrl, { headers = {}, timeoutMs = FETCH_TIMEOUT_MS, maxBytes = 200_000, maxRedirects = 5 } = {}) {
	let current = rawUrl;
	for (let hop = 0; hop <= maxRedirects; hop++) {
		let u;
		try { u = new URL(current); } catch { const e = new Error('invalid URL'); e.code = 'blocked'; throw e; }
		if (!/^https?:$/.test(u.protocol)) { const e = new Error('only http(s) URLs are allowed'); e.code = 'blocked'; throw e; }
		if (isBlockedHost(u.hostname)) { const e = new Error('host is on the SSRF denylist (private/internal)'); e.code = 'blocked'; throw e; }
		const addrs = await resolvePublicAddrs(u.hostname);          // throws on blocked/dns
		const ip = addrs[0].address;
		const isHttps = u.protocol === 'https:';
		const transport = isHttps ? https : http;
		const port = u.port || (isHttps ? 443 : 80);

		const result = await new Promise((resolve, reject) => {
			const req = transport.request({
				host: ip,                                  // connect to the validated IP (pinned — no re-resolve)
				servername: isHttps ? u.hostname : undefined, // TLS SNI + cert validation against the real name
				port, method: 'GET', path: (u.pathname || '/') + (u.search || ''),
				headers: { ...headers, Host: u.host },
			}, res => {
				const status = res.statusCode || 0;
				const loc = res.headers['location'];
				if (status >= 300 && status < 400 && loc) { res.resume(); return resolve({ redirect: new URL(loc, u).toString() }); }
				const chunks = []; let len = 0; let aborted = false;
				res.on('data', c => {
					len += c.length; chunks.push(c);
					if (len > maxBytes + 65536) { aborted = true; req.destroy(); } // cap the download
				});
				res.on('end', () => resolve({ statusCode: status, headers: res.headers, body: Buffer.concat(chunks), finalUrl: u.toString(), aborted }));
				res.on('error', err => reject(tag(err, 'error')));
			});
			req.setTimeout(timeoutMs, () => req.destroy(tag(new Error('fetch timed out'), 'timeout')));
			req.on('error', err => reject(err.code ? err : tag(err, 'error')));
			req.end();
		});

		if (result.redirect) { current = result.redirect; continue; }
		return result;
	}
	const e = new Error('too many redirects'); e.code = 'error'; throw e;
}

function tag(err, code) { if (!err.code) { err.code = code; } return err; }

// ---- entity + html helpers --------------------------------------------------

function decodeEntities(s) {
	return s
		.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ''; } })
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } });
}

function stripToText(html) {
	return decodeEntities(
		html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]+>/g, ' '),
	).replace(/\s+/g, ' ').trim();
}

function extractTitle(html) {
	const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim().slice(0, 300) : '';
}

// Remove the parts of a page that are noise for an LLM, then keep the richest
// content region (<main>/<article> if present, else <body>).
function isolateMainContent(html) {
	let h = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|svg|form|iframe|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ');
	const main = /<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i.exec(h);
	if (main && main[1].length > 400) { return main[1]; }
	const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(h);
	return body ? body[1] : h;
}

// Compact, dependency-free HTML→Markdown for LLM reading. Not a full DOM parser,
// but converts the structural tags that matter (headings, links, lists, code,
// emphasis, blockquotes, paragraphs) and drops the rest.
function htmlToMarkdown(html) {
	let s = isolateMainContent(html);
	s = s
		.replace(/<(?:h1)[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n\n# ${stripInline(t)}\n\n`)
		.replace(/<(?:h2)[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n## ${stripInline(t)}\n\n`)
		.replace(/<(?:h3)[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n### ${stripInline(t)}\n\n`)
		.replace(/<(?:h4|h5|h6)[^>]*>([\s\S]*?)<\/(?:h4|h5|h6)>/gi, (_, t) => `\n\n#### ${stripInline(t)}\n\n`)
		.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\n\n\`\`\`\n${decodeEntities(t.replace(/<[^>]+>/g, '')).trim()}\n\`\`\`\n\n`)
		.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n> ${stripInline(t)}\n`)
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${stripInline(t)}`)
		.replace(/<\/(?:ul|ol)>/gi, '\n\n')
		.replace(/<(?:p|div|section|tr)[^>]*>/gi, '\n\n')
		.replace(/<br\s*\/?>/gi, '\n');
	s = stripInline(s);
	// collapse excess blank lines
	return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Inline-level conversion: links, bold, italic, inline code — then drop tags.
function stripInline(html) {
	return decodeEntities(
		html
			.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => {
				const t = txt.replace(/<[^>]+>/g, '').trim();
				return t ? `[${t}](${href})` : '';
			})
			.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_, t) => `**${t.replace(/<[^>]+>/g, '').trim()}**`)
			.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_, t) => `*${t.replace(/<[^>]+>/g, '').trim()}*`)
			.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${t.replace(/<[^>]+>/g, '').trim()}\``)
			.replace(/<[^>]+>/g, ''),
	).replace(/[ \t]{2,}/g, ' ').trim();
}

function sanitizeHtml(html) {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style|noscript|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
		.replace(/\son\w+=["'][^"']*["']/gi, '')
		.replace(/\shref=["']javascript:[^"']*["']/gi, ' href="#"');
}

// ---- freshness / query builders --------------------------------------------

const FRESHNESS = {
	pd: { brave: 'pd', ddg: 'd', days: 1 },
	pw: { brave: 'pw', ddg: 'w', days: 7 },
	pm: { brave: 'pm', ddg: 'm', days: 30 },
	py: { brave: 'py', ddg: 'y', days: 365 },
};

function withSite(query, siteFilter) {
	return siteFilter ? `${query} site:${siteFilter.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}` : query;
}

// ---- providers --------------------------------------------------------------

async function braveSearch(query, { maxResults, freshness, siteFilter }) {
	if (!BRAVE_KEY) { return null; }
	const params = new URLSearchParams({ q: withSite(query, siteFilter), count: String(Math.min(maxResults, 20)) });
	if (freshness && FRESHNESS[freshness]) { params.set('freshness', FRESHNESS[freshness].brave); }
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
	try {
		const r = await fetch('https://api.search.brave.com/res/v1/web/search?' + params, {
			signal: ac.signal,
			headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_KEY },
		});
		if (!r.ok) { return null; }
		const j = await r.json();
		const items = (j.web && Array.isArray(j.web.results)) ? j.web.results : [];
		return items.slice(0, maxResults).map(it => ({
			title: String(it.title || '').slice(0, 200),
			url: String(it.url || ''),
			snippet: stripToText(String(it.description || '')).slice(0, 300),
			published_at: it.age || it.page_age || '',
		})).filter(h => h.url);
	} catch { return null; } finally { clearTimeout(t); }
}

async function tavilySearch(query, { maxResults, freshness, siteFilter }) {
	if (!TAVILY_KEY) { return null; }
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
	try {
		const body = { api_key: TAVILY_KEY, query: withSite(query, siteFilter), max_results: Math.min(maxResults, 20), search_depth: 'basic' };
		if (freshness && FRESHNESS[freshness]) { body.days = FRESHNESS[freshness].days; }
		const r = await fetch('https://api.tavily.com/search', {
			method: 'POST', signal: ac.signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!r.ok) { return null; }
		const j = await r.json();
		const items = Array.isArray(j.results) ? j.results : [];
		return items.slice(0, maxResults).map(it => ({
			title: String(it.title || '').slice(0, 200),
			url: String(it.url || ''),
			snippet: stripToText(String(it.content || '')).slice(0, 300),
			published_at: it.published_date || '',
		})).filter(h => h.url);
	} catch { return null; } finally { clearTimeout(t); }
}

async function duckduckgoSearch(query, { maxResults, freshness, siteFilter }) {
	const params = new URLSearchParams({ q: withSite(query, siteFilter) });
	if (freshness && FRESHNESS[freshness]) { params.set('df', FRESHNESS[freshness].ddg); }
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
	try {
		const r = await fetch('https://html.duckduckgo.com/html/?' + params, {
			signal: ac.signal,
			headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) ' + UA, 'Accept': 'text/html' },
		});
		if (!r.ok) { return null; }
		const html = await r.text();
		const hits = [];
		const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
		let m;
		while ((m = re.exec(html)) && hits.length < maxResults) {
			let url = m[1];
			const dd = /uddg=([^&]+)/.exec(url);
			if (dd) { try { url = decodeURIComponent(dd[1]); } catch { /* keep */ } }
			hits.push({ title: stripToText(m[2]).slice(0, 200), url, snippet: '', published_at: '' });
		}
		const sre = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
		let i = 0, sm;
		while ((sm = sre.exec(html)) && i < hits.length) { hits[i].snippet = stripToText(sm[1]).slice(0, 300); i++; }
		return hits.filter(h => h.url);
	} catch { return null; } finally { clearTimeout(t); }
}

// Ordered provider chain honoring a preference, falling back automatically.
function providerChain(preferred) {
	const all = [
		['brave', braveSearch, !!BRAVE_KEY],
		['tavily', tavilySearch, !!TAVILY_KEY],
		['duckduckgo', duckduckgoSearch, true], // keyless — always available
	];
	const enabled = all.filter(([, , on]) => on);
	if (preferred) {
		const first = enabled.filter(([name]) => name === preferred);
		const rest = enabled.filter(([name]) => name !== preferred);
		return [...first, ...rest];
	}
	return enabled;
}

// ---- public: webSearch ------------------------------------------------------

export async function webSearch(query, opts = {}, userId = 'anon', planId = 'free') {
	const q = String(query || '').trim();
	if (!q) { return { provider: '', hits: [], hit_count: 0, cached: false, truncated: false, latency_ms: 0 }; }
	const maxResults = Math.max(1, Math.min(20, Number(opts.max_results) || 8));
	const freshness = ['pd', 'pw', 'pm', 'py'].includes(opts.freshness) ? opts.freshness : '';
	const siteFilter = typeof opts.site_filter === 'string' ? opts.site_filter.trim().slice(0, 200) : '';
	const preferred = ['brave', 'tavily', 'duckduckgo'].includes(opts.provider) ? opts.provider : '';

	const cacheKey = JSON.stringify(['s', q, maxResults, freshness, siteFilter, preferred]);
	const hit = searchCache.get(cacheKey);
	if (hit) { return { ...hit, cached: true }; }

	// quota (skip enforcement for anon/internal callers with no userId gating)
	const quota = checkAndBump(userId, 'search', planId);
	if (!quota.ok) {
		return { provider: '', hits: [], hit_count: 0, cached: false, truncated: false, latency_ms: 0,
			error: `web search daily quota exhausted (${quota.limit}/day) — resets in ~${Math.ceil(quota.reset_in_s / 3600)}h`, code: 'web_search_quota_exhausted' };
	}

	const started = Date.now();
	const opt = { maxResults, freshness, siteFilter };
	let hits = null;
	let providerUsed = '';
	for (const [name, fn] of providerChain(preferred)) {
		const r = await fn(q, opt);
		if (r && r.length > 0) { hits = r; providerUsed = name; break; }
		if (r && r.length === 0 && !hits) { providerUsed = name; hits = []; } // record attempt but keep trying others
	}
	hits = hits || [];
	const out = {
		provider: providerUsed || 'duckduckgo',
		hits,
		hit_count: hits.length,
		cached: false,
		truncated: hits.length >= maxResults,
		latency_ms: Date.now() - started,
	};
	if (hits.length > 0) { searchCache.set(cacheKey, out); }
	return out;
}

// ---- public: webFetch -------------------------------------------------------

export async function webFetch(rawUrl, opts = {}, userId = 'anon', planId = 'free') {
	let u;
	try { u = new URL(String(rawUrl)); } catch { return { error: 'invalid URL', code: 'web_fetch_blocked' }; }
	if (!/^https?:$/.test(u.protocol)) { return { error: 'only http(s) URLs are allowed', code: 'web_fetch_blocked' }; }
	if (isBlockedHost(u.hostname)) { return { error: 'host is on the SSRF denylist (private/internal)', code: 'web_fetch_blocked' }; }

	const format = ['markdown', 'html', 'text'].includes(opts.format) ? opts.format : 'markdown';
	const maxBytes = Math.max(1024, Math.min(5_000_000, Number(opts.max_bytes) || 200_000));

	const cacheKey = JSON.stringify(['f', u.toString(), format, maxBytes]);
	const cached = fetchCache.get(cacheKey);
	if (cached) { return { ...cached, cached: true }; }

	const quota = checkAndBump(userId, 'fetch', planId);
	if (!quota.ok) {
		return { error: `web fetch daily quota exhausted (${quota.limit}/day) — resets in ~${Math.ceil(quota.reset_in_s / 3600)}h`, code: 'web_fetch_quota_exhausted' };
	}

	const started = Date.now();
	try {
		const r = await fetchPinned(u.toString(), {
			timeoutMs: FETCH_TIMEOUT_MS, maxBytes,
			headers: { 'User-Agent': UA, 'Accept': 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' },
		});
		const ct = String(r.headers['content-type'] || '').toLowerCase();
		// reject binary content up front
		if (/^(image|video|audio|font)\//.test(ct) || /application\/(pdf|octet-stream|zip|gzip|x-tar|msword|vnd\.)/.test(ct)) {
			return { error: `unsupported binary content-type: ${ct || 'unknown'} — this tool reads text/HTML/JSON only`, code: 'web_fetch_unsupported' };
		}
		const finalUrl = r.finalUrl || u.toString();
		const raw = r.body.toString('utf8');
		const title = /text\/html/i.test(ct) ? extractTitle(raw) : '';
		let content;
		if (/text\/html/i.test(ct)) {
			content = format === 'html' ? sanitizeHtml(raw) : format === 'text' ? stripToText(raw) : htmlToMarkdown(raw);
		} else if (/application\/json/i.test(ct)) {
			try { content = '```json\n' + JSON.stringify(JSON.parse(raw), null, 2) + '\n```'; }
			catch { content = raw; }
		} else {
			content = raw; // text/plain, text/markdown, etc.
		}
		const fullLen = Buffer.byteLength(content, 'utf8');
		const truncated = fullLen > maxBytes;
		if (truncated) { content = Buffer.from(content, 'utf8').subarray(0, maxBytes).toString('utf8'); }
		const out = {
			content,
			content_type: ct || 'text/plain',
			title,
			byte_count: Buffer.byteLength(content, 'utf8'),
			truncated,
			final_url: finalUrl,
			status_code: r.statusCode,
			cached: false,
			latency_ms: Date.now() - started,
			fetched_at: new Date().toISOString(),
		};
		if (content) { fetchCache.set(cacheKey, out); }
		return out;
	} catch (e) {
		const msg = String(e && e.message || e);
		if (e && e.code === 'timeout') { return { error: 'fetch timed out', code: 'web_fetch_timeout' }; }
		if (e && e.code === 'blocked') { return { error: msg, code: 'web_fetch_blocked' }; }
		if ((e && e.code === 'dns') || /getaddrinfo|ENOTFOUND|EAI_AGAIN|dns/i.test(msg)) { return { error: `DNS resolution failed: ${msg}`, code: 'web_fetch_dns_failed' }; }
		return { error: msg, code: 'web_fetch_error' };
	}
}
