// Xipher IDE backend — speaks the desktop IDE (alaskaChat) protocol and routes
// to OmniRoute. Zero runtime deps (Node 20+ built-ins only).
//
// Mounted on prod behind xpcore at  ide.xipher.pro/ide-api/*  (prefix stripped
// by xpcore, so this server sees the native /api/... paths).

import http from 'node:http';
import { buildModelsResponse, resolveOmniId, MODEL_MAP, DEFAULT_MODEL, modelMultiplier } from './models.mjs';
import { omniChatStream } from './omniroute.mjs';
import { initAuth, deviceInit, deviceApprove, bindDeviceToUser, syncUserPlan, devicePoll, refresh, revoke, verifyRequest, userPlan, setUserPlan, isAdmin, listUsers, listPendingDevices } from './auth.mjs';
import { usageSnapshot, canAfford, charge, modelAllowed, planOf, PLANS } from './plans.mjs';
import { adminPageHtml } from './adminPage.mjs';
import { embeddings, indexUpsert, indexSearch, indexStatus, indexDeleteWorkspace, indexDeleteFile } from './features.mjs';
import { webSearch, webFetch } from './web.mjs';
import { buildOpenAIBody, chunkToFrames } from './translate.mjs';
import { siteAuthorize, siteCharge, siteVersion, siteAutoUpdateMode } from './siteClient.mjs';
import { attachAgentApi } from './agentApi.mjs';
import { registerExecutor, listAll as adminListExecutors, adminRevoke as adminRevokeExecutor } from './executors.mjs';
import { adminStats as adminSessionStats } from './agentStore.mjs';
import { adminStats as adminMemoryStats } from './memory.mjs';

const PORT = Number(process.env.PORT || 8097);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'https://ide.xipher.pro';

// ---- helpers ---------------------------------------------------------------

function json(res, status, obj) {
	const body = JSON.stringify(obj);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
	});
	res.end(body);
}

async function readBody(req, cap = 8 * 1024 * 1024) {
	const chunks = [];
	let len = 0;
	for await (const c of req) {
		len += c.length;
		if (len > cap) throw new Error('payload too large');
		chunks.push(c);
	}
	return Buffer.concat(chunks).toString('utf8');
}

function sseInit(res) {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive',
		'Access-Control-Allow-Origin': '*',
		'X-Accel-Buffering': 'no',
	});
}
function sseSend(res, frame) { res.write(`data: ${JSON.stringify(frame)}\n\n`); }
// One-line-per-turn diagnostics for the desktop chat path (journalctl -u ide-backend).
// ttfv = ms to first visible byte; closed = ms at which the client/proxy dropped (0 = never).
function chatLog(model, t0, ttfv, chars, reasoning, finish, closedAt, attempt, how) {
	console.error(`[chat] model=${model} dur=${Date.now() - t0}ms ttfv=${ttfv || '-'}ms visible=${chars} reasoning=${reasoning} finish=${finish || '-'} client_closed=${closedAt || '-'} attempt=${attempt} end=${how}`);
}

// buildOpenAIBody + chunkToFrames now live in translate.mjs (shared with agentLoop).

// ---- handlers --------------------------------------------------------------

async function handleModels(req, res, userId) {
	json(res, 200, buildModelsResponse(userPlan(userId)));
}

async function handleUsage(req, res, userId) {
	const plan = userPlan(userId);
	const s = usageSnapshot(userId, plan);
	json(res, 200, {
		period: 'weekly', plan: s.plan, plan_label: s.plan_label,
		requests: 0, limit: s.creditsWeek_limit,
		input: 0, output: 0, max_tokens: 0,
		credits_used: s.creditsWeek_used, weekly_budget: s.creditsWeek_limit,
		credits5h_used: s.credits5h_used, credits5h_limit: s.credits5h_limit,
	});
}

// ---- auth handlers ---------------------------------------------------------

async function bodyJson(req) { try { return JSON.parse(await readBody(req) || '{}'); } catch { return {}; } }

async function handleDeviceInit(req, res) {
	return json(res, 200, deviceInit(PUBLIC_BASE));
}
// Verify a Xipher account (email+password) against the site backend (loopback).
const SITE_BACKEND_URL = process.env.SITE_BACKEND_URL || 'http://127.0.0.1:8096';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

// siteAuthorize / siteCharge / siteVersion / siteAutoUpdateMode now live in
// siteClient.mjs (shared with agentLoop). Imported at the top of the file.

// The IDE polls this to learn the latest published version, per-platform download
// URLs, and the user's chosen auto-update mode (off | notify | silent).
async function handleUpdateCheck(req, res, userId) {
	const [ver, mode] = await Promise.all([siteVersion(), siteAutoUpdateMode(userId)]);
	return json(res, 200, {
		version: ver ? ver.version : null,
		windows: ver ? ver.windows : null,
		linux: ver ? ver.linux : null,
		download_page: (ver && ver.download_page) || 'https://ide.xipher.pro/#/download',
		mode,
	});
}
async function verifySiteLogin(email, password, clientIp) {
	try {
		const r = await fetch(`${SITE_BACKEND_URL}/xapi/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}) },
			body: JSON.stringify({ email, password }),
		});
		if (!r.ok) { return null; }
		const d = await r.json();
		return d && d.user ? d.user : null;
	} catch { return null; }
}

async function handleDeviceApprove(req, res) {
	const b = await bodyJson(req);
	// Primary: approve by logging into the Xipher account.
	if (b.email && b.password) {
		const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
		const siteUser = await verifySiteLogin(b.email, b.password, clientIp);
		if (!siteUser) { return json(res, 401, { ok: false, error: 'bad_credentials' }); }
		const r = bindDeviceToUser(b.user_code, siteUser);
		return json(res, r.ok ? 200 : 400, { ...r, email: siteUser.email, plan: siteUser.plan_label || siteUser.plan });
	}
	// Fallback: owner/ops approval via admin token.
	const admin = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || b.admin_token;
	const r = deviceApprove(admin, b.user_code, b.userId);
	return json(res, r.ok ? 200 : 403, r);
}
async function handleDevicePoll(req, res, deviceCode) {
	const r = devicePoll(deviceCode);
	return json(res, r.status, r.body);
}
async function handleRefresh(req, res) {
	const b = await bodyJson(req);
	const r = refresh(b.refresh_token || b.refreshToken, b.refresh_family);
	return json(res, r.status, r.body);
}
async function handleRevoke(req, res) {
	const b = await bodyJson(req);
	const tok = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || b.access_token;
	const r = revoke(tok);
	return json(res, r.status, r.body);
}

// device approval page (opened in the browser by the IDE's sign-in flow)
function handleDevicePage(req, res, code) {
	const safe = String(code || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 12);
	const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Xipher IDE · вход</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e11;color:#e6edf3;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.card{width:min(92vw,420px);background:#12161b;border:1px solid #222b34;border-radius:16px;padding:28px}
h1{font-size:18px;margin:0 0 4px}.sub{color:#8b98a5;font-size:13px;margin:0 0 20px}
.code{font:600 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:3px;text-align:center;background:#0b0e11;border:1px solid #222b34;border-radius:10px;padding:16px;margin:0 0 18px}
label{display:block;font-size:12px;color:#8b98a5;margin:0 0 6px}
input{width:100%;padding:11px 12px;background:#0b0e11;border:1px solid #222b34;border-radius:9px;color:#e6edf3;font:13px ui-monospace,monospace}
button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:9px;background:#2f81f7;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
.msg{margin-top:14px;font-size:13px;text-align:center;min-height:18px}
.ok{color:#3fb950}.err{color:#f85149}
.mark{width:34px;height:34px;margin:0 auto 14px;display:block}
</style></head><body>
<div class="card">
<svg class="mark" viewBox="0 0 26 26" fill="none"><path d="M13 1 L25 13 L13 25 L1 13 Z" stroke="#2f81f7" stroke-width="1.2" stroke-opacity=".4"/><path d="M13 7 L19 13 L13 19 L7 13 Z" fill="#2f81f7"/></svg>
<h1>Вход в Xipher IDE</h1>
<p class="sub">Войдите в аккаунт Xipher, чтобы подтвердить это устройство:</p>
<div class="code" id="code">${safe || '····-····'}</div>
<label>Email</label>
<input id="email" type="email" placeholder="you@example.com" autocomplete="username" style="font-family:system-ui">
<label style="margin-top:12px">Пароль</label>
<input id="pw" type="password" placeholder="пароль от аккаунта" autocomplete="current-password" style="font-family:system-ui">
<button id="go">Войти и подтвердить</button>
<div class="msg" id="msg"></div>
<p class="sub" style="text-align:center;margin:16px 0 0;font-size:12px">Нет аккаунта? <a href="https://ide.xipher.pro/#/register" target="_blank" style="color:#2f81f7">Создать</a></p>
<details style="margin-top:12px"><summary style="color:#6b7684;font-size:11px;cursor:pointer">Владелец сервера · вход по admin-токену</summary>
<input id="tok" type="password" placeholder="ADMIN_TOKEN" autocomplete="off" style="margin-top:8px;font-family:ui-monospace,monospace">
<button id="goAdmin" style="background:#2a2f37">Подтвердить как владелец</button></details>
</div>
<script>
const base = location.pathname.replace(/\\/device\\/?$/,'');
const $=id=>document.getElementById(id);
const uc=()=>$('code').textContent.trim();
async function approve(body,btn){
  $(btn).disabled=true;$('msg').className='msg';$('msg').textContent='…';
  try{
    const r=await fetch(base+'/api/auth/device/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_code:uc(),...body})});
    const d=await r.json();
    if(r.ok&&d.ok){$('msg').className='msg ok';$('msg').textContent='✓ Устройство подтверждено'+(d.email?' ('+d.email+(d.plan?' · '+d.plan:'')+')':'')+' — вернитесь в IDE';$(btn).textContent='Готово';}
    else{$('msg').className='msg err';$('msg').textContent='Ошибка: '+(d.error==='bad_credentials'?'неверный email или пароль':d.error==='forbidden'?'неверный admin-токен':(d.error||r.status));$(btn).disabled=false;}
  }catch(e){$('msg').className='msg err';$('msg').textContent='Сеть: '+e.message;$(btn).disabled=false;}
}
$('go').onclick=()=>{const email=$('email').value.trim(),password=$('pw').value;if(!email||!password){$('msg').className='msg err';$('msg').textContent='Введите email и пароль';return;}approve({email,password},'go');};
$('pw').addEventListener('keydown',e=>{if(e.key==='Enter')$('go').click();});
$('goAdmin').onclick=()=>{const admin_token=$('tok').value.trim();if(!admin_token){$('msg').className='msg err';$('msg').textContent='Введите admin-токен';return;}approve({admin_token},'goAdmin');};
</script></body></html>`;
	res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
	res.end(html);
}

// gate: verify HMAC-signed request; returns userId or writes 401 and returns null
function requireAuth(req, res, path) {
	const v = verifyRequest(req.headers, req.method || 'GET', path);
	if (!v.ok) { json(res, v.status, { message: `unauthorized: ${v.error}` }); return null; }
	return v.userId;
}

// ---- admin API (gated by the admin token; used by the admin panel) ---------

function adminToken(req) {
	return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || req.headers['x-admin-token'] || '';
}
function requireAdmin(req, res) {
	if (!isAdmin(adminToken(req))) { json(res, 403, { message: 'forbidden' }); return false; }
	return true;
}
function handleAdminOverview(req, res) {
	const users = listUsers().map(u => ({ ...u, usage: usageSnapshot(u.id, u.plan) }));
	const plans = Object.values(PLANS).map(p => ({ id: p.id, label: p.label, credits5h: p.credits5h, creditsWeek: p.creditsWeek, allModels: !!p.allModels }));
	const models = Object.entries(MODEL_MAP).map(([id, m]) => ({ id, label: m.label, provider: m.provider, mult: m.mult, minTier: m.minTier || 'free', ctx: m.ctx, reasoning: !!m.reasoning }));
	// Web Code platform: live executors (local daemons / SSH / open IDEs), sessions, memory
	const executors = adminListExecutors();
	const sessions = adminSessionStats();
	const memory = adminMemoryStats();
	json(res, 200, {
		users, plans, models, pending: listPendingDevices(),
		executors, sessions, memory,
		stats: { users: users.length, models: models.length, executorsOnline: executors.filter(e => e.status === 'online').length, executorsTotal: executors.length, sessions: sessions.totalSessions },
	});
}
async function handleAdminSetPlan(req, res) {
	const b = await bodyJson(req);
	if (!b.userId || !PLANS[b.plan]) return json(res, 400, { message: 'userId and valid plan required' });
	json(res, 200, { ok: true, profile: setUserPlan(b.userId, b.plan) });
}
async function handleAdminApprove(req, res) {
	const b = await bodyJson(req);
	const r = deviceApprove(adminToken(req), b.user_code, b.userId);
	json(res, r.ok ? 200 : 400, r);
}
async function handleAdminRevokeExecutor(req, res) {
	const b = await bodyJson(req);
	if (!b.executorId) return json(res, 400, { message: 'executorId required' });
	json(res, 200, { ok: adminRevokeExecutor(b.executorId) });
}

// ---- embeddings / index / web (all HMAC-protected) -------------------------

async function handleEmbeddings(req, res) {
	const b = await bodyJson(req);
	return json(res, 200, embeddings(b.input));
}
async function handleIndexUpsert(req, res, userId) {
	const b = await bodyJson(req);
	return json(res, 200, indexUpsert(userId, b.workspace_id, b.chunks));
}
async function handleIndexSearch(req, res, userId) {
	const b = await bodyJson(req);
	return json(res, 200, indexSearch(userId, b.workspace_id, b.query, b.top_k, b.file_filter));
}
async function handleWebSearch(req, res, userId) {
	const b = await bodyJson(req);
	const planId = userPlan(userId);
	const r = await webSearch(b.query, {
		max_results: b.max_results, freshness: b.freshness, site_filter: b.site_filter, provider: b.provider,
	}, userId, planId);
	if (r.code === 'web_search_quota_exhausted') { return json(res, 403, { message: r.error, code: r.code }); }
	return json(res, 200, r);
}
async function handleWebFetch(req, res, userId) {
	const b = await bodyJson(req);
	const planId = userPlan(userId);
	const r = await webFetch(b.url, { format: b.format, max_bytes: b.max_bytes }, userId, planId);
	if (r.code === 'web_fetch_quota_exhausted') { return json(res, 403, { message: r.error, code: r.code }); }
	if (r.code === 'web_fetch_timeout') { return json(res, 504, { message: r.error, code: r.code }); }
	if (r.code === 'web_fetch_blocked' || r.code === 'web_fetch_dns_failed' || r.code === 'web_fetch_unsupported') {
		return json(res, 400, { message: r.error, code: r.code });
	}
	if (r.code === 'web_fetch_error') { return json(res, 502, { message: r.error, code: r.code }); }
	return json(res, 200, r);
}

async function handleChat(req, res, userId) {
	let body;
	try { body = JSON.parse(await readBody(req)); }
	catch { return json(res, 400, { message: 'invalid JSON body' }); }

	// tier gate + rolling-window credit check BEFORE opening the stream.
	// Credits + plan are authoritative on the SITE ledger (so the account's
	// dashboard reflects real IDE usage and there's one limit). If the site is
	// unreachable we fall back to the local ledger so the IDE keeps working.
	const model = MODEL_MAP[body.model] ? body.model : DEFAULT_MODEL;
	const cost = modelMultiplier(model);
	let plan = userPlan(userId);
	let useSiteLedger = false;

	const authz = await siteAuthorize(userId, cost);
	if (authz) {
		useSiteLedger = true;
		if (authz.plan) { syncUserPlan(userId, authz.plan); plan = authz.plan; } // use the authoritative SITE plan (userPlan() is 'free' for web-only users)
		if (!authz.ok) {
			return json(res, 429, { message: `Credit limit reached (${authz.window})`, code: 'quota_exhausted', window: authz.window, reset_in_s: authz.reset_in_s });
		}
	} else {
		const afford = canAfford(userId, plan, cost); // local fallback
		if (!afford.ok) {
			return json(res, 429, { message: `Credit limit reached (${afford.window})`, code: 'quota_exhausted', window: afford.window, reset_in_s: afford.reset_in_s });
		}
	}

	// model access gate against the (possibly refreshed) plan
	if (!modelAllowed(plan, MODEL_MAP[model])) {
		return json(res, 403, { message: `Model "${model}" requires a higher plan`, code: 'model_locked', plan, required_plan: MODEL_MAP[model].minTier });
	}

	sseInit(res);
	const ac = new AbortController();
	const t0 = Date.now();
	let finished = false, clientClosedAt = 0, ttfvMs = 0, visibleChars = 0, reasoningChars = 0, attemptN = 0;
	req.on('close', () => { if (!finished) { clientClosedAt = Date.now() - t0; } ac.abort(); }); // record a premature client/proxy disconnect
	const state = { finish: undefined, usage: undefined };
	let charged = false;
	// Keepalive heartbeat. Claude via claude/* can reason for 60–90s inside a
	// <think> block that the upstream strips, so NO bytes reach us during that
	// window (measured silent gaps up to 15s). Over the desktop's SSE/HTTP hop that
	// idle stretch gets connection-cut before the answer lands, and the client reads
	// the premature close as an empty turn ("модель вернула пустой ответ"). The web
	// path survives only because its WebSocket hop is proxied without a timeout. A
	// comment line (":") is ignored by the SSE parser, so it holds the socket open.
	const heartbeat = setInterval(() => { try { res.write(':\n\n'); } catch { /* socket gone */ } }, 5000);
	const openaiBody = buildOpenAIBody({ ...body, model });
	const MAX_ATTEMPTS = 3; // retries on a transient upstream ERROR (bad-account rotation)
	try {
		for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
			attemptN = attempt;
			let gotVisible = false;
			try {
				for await (const chunk of omniChatStream(openaiBody, ac.signal)) {
					for (const f of chunkToFrames(chunk, state)) {
						if (f.reasoning) { reasoningChars += f.reasoning.length; }
						if (f.delta || f.tool_delta) {
							gotVisible = true;
							if (f.delta) { if (!ttfvMs) { ttfvMs = Date.now() - t0; } visibleChars += f.delta.length; }
							if (!charged) { charged = true; if (useSiteLedger) { void siteCharge(userId, cost, model); } else { charge(userId, cost); } } // charge once real output flows — never for an empty turn
						}
						sseSend(res, f);
					}
				}
			} catch (e) {
				if (ac.signal.aborted) { clearInterval(heartbeat); chatLog(model, t0, ttfvMs, visibleChars, reasoningChars, state.finish, clientClosedAt, attemptN, 'aborted'); try { res.end(); } catch {} return; }
				// transient upstream error (OmniRoute rotating onto an unhealthy Claude
				// account → 502 / invalid-header / credential exhaustion), nothing sent
				// yet → wait out the rotation and retry the turn before surfacing.
				if (attempt < MAX_ATTEMPTS && !charged) { state.finish = undefined; await new Promise(r => setTimeout(r, 400 * (attempt + 1))); continue; }
				sseSend(res, { error: 'Провайдер этой модели временно недоступен — попробуйте ещё раз или выберите другую модель.' });
				break;
			}
			if (gotVisible || charged || attempt >= 1) { break; } // real output, or one empty retry → stop. A clean empty (finish=stop, no content) from Claude is usually a content decline — retrying won't change it, so fail fast instead of spinning.
			state.finish = undefined;
		}
		sseSend(res, { done: true, finish_reason: state.finish, usage: state.usage });
	} finally {
		clearInterval(heartbeat);
	}
	finished = true;
	chatLog(model, t0, ttfvMs, visibleChars, reasoningChars, state.finish, clientClosedAt, attemptN, 'done');
	res.end();
}

// ---- router ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, 'http://x');
	const path = url.pathname;
	const method = req.method || 'GET';

	if (method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,PUT,OPTIONS',
			'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Client-Key,X-Checksum,Accept',
		});
		return res.end();
	}

	try {
		if (path === '/healthz') return json(res, 200, { ok: true, models: Object.keys(MODEL_MAP).length });
		if (path === '/device' && method === 'GET') return handleDevicePage(req, res, url.searchParams.get('code'));

		// --- admin panel + admin API (admin-token gated) ---
		if (path === '/admin' && method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, must-revalidate' }); return res.end(adminPageHtml()); }
		if (path === '/api/admin/overview' && method === 'GET') { if (!requireAdmin(req, res)) return; return handleAdminOverview(req, res); }
		if (path === '/api/admin/user-plan' && method === 'POST') { if (!requireAdmin(req, res)) return; return await handleAdminSetPlan(req, res); }
		if (path === '/api/admin/approve' && method === 'POST') { if (!requireAdmin(req, res)) return; return await handleAdminApprove(req, res); }
		if (path === '/api/admin/executor-revoke' && method === 'POST') { if (!requireAdmin(req, res)) return; return await handleAdminRevokeExecutor(req, res); }

		// --- auth (open; approve is admin-gated inside) ---
		if (path === '/api/auth/device/init' && method === 'POST') return await handleDeviceInit(req, res);
		if (path === '/api/auth/device/approve' && method === 'POST') return await handleDeviceApprove(req, res);
		if (path === '/api/auth/device/poll' && method === 'GET') return await handleDevicePoll(req, res, url.searchParams.get('device_code'));
		if (path === '/api/auth/refresh' && method === 'POST') return await handleRefresh(req, res);
		if (path === '/api/auth/revoke' && method === 'POST') return await handleRevoke(req, res);

		// --- AI (HMAC-protected) ---
		if (path === '/api/ai/models' && method === 'GET') { const u = requireAuth(req, res, path); if (!u) return; return await handleModels(req, res, u); }
		if (path === '/api/ai/usage' && method === 'GET') { const u = requireAuth(req, res, path); if (!u) return; return await handleUsage(req, res, u); }
		if (path === '/api/update/check' && method === 'GET') { const u = requireAuth(req, res, path); if (!u) return; return await handleUpdateCheck(req, res, u); }
		if (path === '/api/me/quota' && method === 'GET') {
			const u = requireAuth(req, res, path); if (!u) return;
			const s = usageSnapshot(u, userPlan(u));
			return json(res, 200, { plan: s.plan_label, budget_credits: s.creditsWeek_limit, spent_credits: s.creditsWeek_used, carried_in_credits: 0 });
		}
		if (path === '/api/ai/providers/health' && method === 'GET') return json(res, 200, { providers: [] });
		if (path === '/api/ai/chat' && method === 'POST') { const u = requireAuth(req, res, path); if (!u) return; return await handleChat(req, res, u); }
		if (path === '/api/ai/embeddings' && method === 'POST') { if (!requireAuth(req, res, path)) return; return await handleEmbeddings(req, res); }
		if (path === '/api/ai/web_search' && method === 'POST') { const u = requireAuth(req, res, path); if (!u) return; return await handleWebSearch(req, res, u); }
		if (path === '/api/ai/web_fetch' && method === 'POST') { const u = requireAuth(req, res, path); if (!u) return; return await handleWebFetch(req, res, u); }

		// --- desktop IDE registers itself as a live `ide` executor (HMAC-authed,
		//     so the web can work in the workspace open in the IDE) ---
		if (path === '/api/agent/executors/register' && method === 'POST') {
			const u = requireAuth(req, res, path); if (!u) return;
			const b = await bodyJson(req);
			return json(res, 200, registerExecutor(u, { executorId: b.executorId, name: b.name, root: b.root, os: b.os, caps: b.caps }));
		}

		// --- Web "Code" platform (site-session bearer auth, handled in agentApi) ---
		if (path.startsWith('/api/agent/')) {
			const handled = await agentApi.route(req, res, url, method);
			if (handled) return;
		}

		// --- codebase index / RAG (HMAC-protected) ---
		if (path === '/api/index/upsert' && method === 'POST') { const u = requireAuth(req, res, path); if (!u) return; return await handleIndexUpsert(req, res, u); }
		if (path === '/api/index/search' && method === 'POST') { const u = requireAuth(req, res, path); if (!u) return; return await handleIndexSearch(req, res, u); }
		if (path === '/api/index/status' && method === 'GET') { const u = requireAuth(req, res, path); if (!u) return; return json(res, 200, indexStatus(u, url.searchParams.get('workspace_id'))); }
		if (path === '/api/index/workspace' && method === 'DELETE') { const u = requireAuth(req, res, path); if (!u) return; return json(res, 200, indexDeleteWorkspace(u, url.searchParams.get('workspace_id'))); }
		if (path === '/api/index/file' && method === 'DELETE') { const u = requireAuth(req, res, path); if (!u) return; return json(res, 200, indexDeleteFile(u, url.searchParams.get('workspace_id'), url.searchParams.get('file_path'))); }

		return json(res, 404, { message: `no route: ${method} ${path}` });
	} catch (e) {
		return json(res, 500, { message: String(e && e.message || e) });
	}
});

initAuth();
// Web "Code" platform: REST session routes + the RFC6455 WebSocket relay, wired
// onto this same HTTP server (the upgrade handler is attached here).
const agentApi = attachAgentApi(server);
// Long-lived SSE: an agentrouter/* turn can stream for many minutes. Disable the
// socket inactivity timeout and the request-receive deadline so Node's HTTP layer
// never cuts a slow stream out from under omniChatStream (which owns the upstream
// idle timeout itself — see omniroute.mjs OMNI_STREAM_IDLE_MS).
server.timeout = 0;            // no socket inactivity timeout (default already 0)
server.requestTimeout = 0;     // don't cap time to receive the request (default 300s)
server.headersTimeout = 0;     // don't cap time to receive headers
server.keepAliveTimeout = 75000;
server.listen(PORT, HOST, () => {
	console.log(`[ide-backend] listening on http://${HOST}:${PORT}  (${Object.keys(MODEL_MAP).length} models)`);
});
