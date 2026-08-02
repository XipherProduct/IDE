// Simulates the desktop IDE: device flow + HMAC-signed requests.
// Verifies the security layer end-to-end (positive + negative).
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8097';
const ADMIN = process.env.ADMIN_TOKEN || 'testadmin';

function sign(secretHex, subject, method, path) {
	const bucket = Math.floor(Date.now() / 1000 / 60);
	const key = Buffer.from(secretHex, 'hex');
	return crypto.createHmac('sha256', key).update(`${subject}\n${method.toUpperCase()}\n${path}\n${bucket}`).digest('hex');
}
function headers(creds, method, path, extra = {}) {
	return {
		'Authorization': `Bearer ${creds.accessToken}`,
		'X-Client-Key': creds.clientKey,
		'X-Checksum': sign(creds.hmacSecret, creds.userId, method, path),
		...extra,
	};
}
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
let pass = 0, fail = 0;
function check(name, cond, info = '') { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${info}`); } }

const P = (p) => `${BASE}/api/${p}`;

async function main() {
	// 1. device init
	const init = await j(await fetch(P('auth/device/init'), { method: 'POST' }));
	check('device/init returns device_code+user_code', !!(init.device_code && init.user_code), JSON.stringify(init));

	// 2. poll BEFORE approve → 202 pending
	const pend = await fetch(P(`auth/device/poll?device_code=${encodeURIComponent(init.device_code)}`));
	check('poll before approve → 202 pending', pend.status === 202, `got ${pend.status}`);

	// 3. approve with WRONG admin → 403
	const badApprove = await fetch(P('auth/device/approve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_token: 'WRONG', user_code: init.user_code }) });
	check('approve with wrong admin → 403', badApprove.status === 403, `got ${badApprove.status}`);

	// 4. approve with correct admin
	const ok = await j(await fetch(P('auth/device/approve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_token: ADMIN, user_code: init.user_code }) }));
	check('approve with admin ok', ok.ok === true, JSON.stringify(ok));

	// 5. poll (GET) → creds (snake_case + status)
	const pr = await j(await fetch(P(`auth/device/poll?device_code=${encodeURIComponent(init.device_code)}`)));
	const creds = { accessToken: pr.access_token, hmacSecret: pr.hmac_secret, clientKey: pr.client_key, userId: pr.user && pr.user.id };
	check('poll after approve → status approved + creds', pr.status === 'approved' && creds.accessToken && creds.hmacSecret && creds.clientKey && creds.userId, JSON.stringify(pr).slice(0, 120));

	// 6. models WITHOUT auth → 401
	const noauth = await fetch(P('ai/models'));
	check('GET models без auth → 401', noauth.status === 401, `got ${noauth.status}`);

	// 7. models with BAD checksum → 401
	const bad = await fetch(P('ai/models'), { headers: { ...headers(creds, 'GET', '/api/ai/models'), 'X-Checksum': 'deadbeef' } });
	check('GET models с плохим checksum → 401', bad.status === 401, `got ${bad.status}`);

	// 8. models with valid signature → 200
	const mres = await fetch(P('ai/models'), { headers: headers(creds, 'GET', '/api/ai/models') });
	const models = await j(mres);
	check('GET models подписанный → 200 + items', mres.status === 200 && Array.isArray(models.items) && models.items.length > 0, `status ${mres.status}`);
	if (models.items) console.log(`    models: ${models.items.map(m => m.id).join(', ')}`);

	// 9. chat SSE with valid signature
	const chatRes = await fetch(P('ai/chat'), {
		method: 'POST',
		headers: { ...headers(creds, 'POST', '/api/ai/chat'), 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
		body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] }),
	});
	check('POST chat подписанный → 200 SSE', chatRes.status === 200, `got ${chatRes.status}`);
	let text = '', frames = 0, sawDone = false, errFrame = null;
	if (chatRes.body) {
		const reader = chatRes.body.getReader(); const dec = new TextDecoder(); let buf = '';
		const t0 = Date.now();
		while (Date.now() - t0 < 45000) {
			const { value, done } = await reader.read(); if (done) break;
			buf += dec.decode(value, { stream: true });
			let nl; while ((nl = buf.indexOf('\n')) !== -1) {
				const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
				if (!line.startsWith('data:')) continue;
				frames++;
				try { const f = JSON.parse(line.slice(5).trim());
					if (f.delta) text += f.delta;
					if (f.error) errFrame = f.error;
					if (f.done) sawDone = true;
				} catch {}
			}
			if (sawDone) break;
		}
	}
	check('chat выдал текст-дельты', text.length > 0, `frames=${frames} err=${errFrame}`);
	check('chat завершился кадром done', sawDone, `frames=${frames}`);
	console.log(`    assistant said: ${JSON.stringify(text.slice(0, 80))}  (frames=${frames})`);

	// 10. embeddings
	const emb = await j(await fetch(P('ai/embeddings'), { method: 'POST', headers: { ...headers(creds, 'POST', '/api/ai/embeddings'), 'Content-Type': 'application/json' }, body: JSON.stringify({ input: ['function parseArgs handles CLI flags', 'database connection pool retry'] }) }));
	check('embeddings → 2 vectors', Array.isArray(emb.embeddings) && emb.embeddings.length === 2 && emb.embeddings[0].length > 0, `dim=${emb.embeddings && emb.embeddings[0] && emb.embeddings[0].length}`);

	// 11. index upsert (chunks carry the embeddings + opaque ciphertext)
	if (emb.embeddings) {
		const chunks = [
			{ file_path: 'cli.ts', embedding: emb.embeddings[0], ciphertext: 'QQ==', iv: 'Ig==', start_line: 1, end_line: 8, symbol_name: 'parseArgs', symbol_kind: 'function' },
			{ file_path: 'db.ts', embedding: emb.embeddings[1], ciphertext: 'Ug==', iv: 'Iw==', start_line: 1, end_line: 6, symbol_name: 'connect', symbol_kind: 'function' },
		];
		const up = await j(await fetch(P('index/upsert'), { method: 'POST', headers: { ...headers(creds, 'POST', '/api/index/upsert'), 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: 'ws1', chunks }) }));
		check('index/upsert → written 2', up.written === 2, JSON.stringify(up));

		// 12. semantic search: query about CLI parsing → cli.ts should rank first
		const qe = await j(await fetch(P('ai/embeddings'), { method: 'POST', headers: { ...headers(creds, 'POST', '/api/ai/embeddings'), 'Content-Type': 'application/json' }, body: JSON.stringify({ input: ['parse command line arguments flags'] }) }));
		const sr = await j(await fetch(P('index/search'), { method: 'POST', headers: { ...headers(creds, 'POST', '/api/index/search'), 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: 'ws1', query: qe.embeddings[0], top_k: 5 }) }));
		check('index/search → hits, most-relevant first (cli.ts)', sr.hits && sr.hits.length >= 1 && sr.hits[0].file_path === 'cli.ts', `top=${sr.hits && sr.hits[0] && sr.hits[0].file_path} score=${sr.hits && sr.hits[0] && sr.hits[0].score.toFixed(3)}`);

		// 13. status
		const st = await j(await fetch(P('index/status?workspace_id=ws1'), { headers: headers(creds, 'GET', '/api/index/status') }));
		check('index/status → 2 chunks', st.chunks === 2, JSON.stringify(st));
	}

	// 14. web_fetch (network; may be blocked from a datacenter IP)
	const wf = await j(await fetch(P('ai/web_fetch'), { method: 'POST', headers: { ...headers(creds, 'POST', '/api/ai/web_fetch'), 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) }));
	check('web_fetch example.com → content', !!(wf.content && /example/i.test(wf.content)), `code=${wf.code} err=${wf.error} len=${wf.content && wf.content.length}`);

	// 15. tiers: owner (maxx10) sees multipliers + all unlocked
	check('models carry credit_multiplier', typeof models.items[0].credit_multiplier === 'number', `mult=${models.items[0].credit_multiplier}`);
	check('owner plan is maxx10 + nothing locked', models.plan === 'maxx10' && models.items.every(m => !m.locked), `plan=${models.plan}`);

	// 16. FREE-tier user: pro models locked, chat with pro model → 403
	const fi = await j(await fetch(P('auth/device/init'), { method: 'POST' }));
	await fetch(P('auth/device/approve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_token: ADMIN, user_code: fi.user_code, userId: 'freetest' }) });
	const fp = await j(await fetch(P(`auth/device/poll?device_code=${encodeURIComponent(fi.device_code)}`)));
	const fcreds = { accessToken: fp.access_token, hmacSecret: fp.hmac_secret, clientKey: fp.client_key, userId: fp.user.id };
	const fm = await j(await fetch(P('ai/models'), { headers: headers(fcreds, 'GET', '/api/ai/models') }));
	const cheapOpen = fm.items.filter(m => !m.locked).map(m => m.id);
	check('free plan → only cheap models unlocked', fm.plan === 'free' && cheapOpen.length === 4 && cheapOpen.includes('deepseek-v4-flash'), `open=${cheapOpen.join(',')}`);
	const lockChat = await fetch(P('ai/chat'), { method: 'POST', headers: { ...headers(fcreds, 'POST', '/api/ai/chat'), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-4-6', messages: [{ role: 'user', content: 'hi' }] }) });
	check('free plan chat with pro model → 403 locked', lockChat.status === 403, `got ${lockChat.status}`);
	const okChat = await fetch(P('ai/chat'), { method: 'POST', headers: { ...headers(fcreds, 'POST', '/api/ai/chat'), 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'say OK' }] }) });
	check('free plan chat with free model → 200', okChat.status === 200, `got ${okChat.status}`);

	console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
	process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('TEST CRASHED', e); process.exit(2); });
