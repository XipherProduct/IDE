// Verify the FULL path the desktop IDE will use, through xpcore:
//   connect to 127.0.0.1:443 but present Host/SNI = ide.xipher.pro so xpcore
//   routes ide.xipher.pro/ide-api/* -> (strip /ide-api) -> backend.
// Does device flow + HMAC-signed models + streaming chat, all via the proxy.
import https from 'node:https';
import crypto from 'node:crypto';

const HOSTHDR = 'ide.xipher.pro';
const PREFIX = '/ide-api';
const ADMIN = process.env.ADMIN_TOKEN || '';

function req(method, apiPath, { headers = {}, body } = {}) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : undefined;
		const r = https.request({
			host: '127.0.0.1', port: 443, servername: HOSTHDR, rejectUnauthorized: false,
			method, path: PREFIX + apiPath,
			headers: { Host: HOSTHDR, 'Content-Type': 'application/json', ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
		}, (res) => {
			let buf = '';
			res.on('data', c => buf += c);
			res.on('end', () => { let j; try { j = JSON.parse(buf); } catch { j = buf; } resolve({ status: res.statusCode, body: j }); });
		});
		r.on('error', reject);
		if (data) r.write(data);
		r.end();
	});
}
function sign(secretHex, subject, method, apiPath) {
	const bucket = Math.floor(Date.now() / 1000 / 60);
	return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update(`${subject}\n${method.toUpperCase()}\n${apiPath}\n${bucket}`).digest('hex');
}
function signed(creds, method, apiPath) {
	return { Authorization: `Bearer ${creds.accessToken}`, 'X-Client-Key': creds.clientKey, 'X-Checksum': sign(creds.hmacSecret, creds.userId, method, apiPath) };
}

let pass = 0, fail = 0;
const ck = (n, c, i = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}  ${i}`)); };

// streaming chat through the proxy
function chatStream(creds) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });
		const r = https.request({
			host: '127.0.0.1', port: 443, servername: HOSTHDR, rejectUnauthorized: false,
			method: 'POST', path: PREFIX + '/api/ai/chat',
			headers: { Host: HOSTHDR, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Content-Length': Buffer.byteLength(body), ...signed(creds, 'POST', '/api/ai/chat') },
		}, (res) => {
			let buf = '', text = '', frames = 0, done = false, err = null;
			const times = [];
			res.on('data', (c) => {
				times.push(Date.now());
				buf += c.toString();
				let nl; while ((nl = buf.indexOf('\n')) !== -1) {
					const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
					if (!line.startsWith('data:')) continue;
					frames++;
					try { const f = JSON.parse(line.slice(5).trim()); if (f.delta) text += f.delta; if (f.error) err = f.error; if (f.done) done = true; } catch {}
				}
			});
			res.on('end', () => resolve({ status: res.statusCode, text, frames, done, err, chunks: times.length }));
		});
		r.on('error', reject); r.write(body); r.end();
	});
}

async function main() {
	const init = await req('POST', '/api/auth/device/init');
	ck('device/init via proxy', init.status === 200 && init.body.device_code, JSON.stringify(init.body).slice(0, 80));
	const appr = await req('POST', '/api/auth/device/approve', { body: { admin_token: ADMIN, user_code: init.body.user_code } });
	ck('approve via proxy', appr.status === 200 && appr.body.ok, JSON.stringify(appr.body));
	const poll = await req('GET', `/api/auth/device/poll?device_code=${encodeURIComponent(init.body.device_code)}`);
	const pb = poll.body;
	const creds = { accessToken: pb.access_token, hmacSecret: pb.hmac_secret, clientKey: pb.client_key, userId: pb.user && pb.user.id };
	ck('poll → creds via proxy', poll.status === 200 && pb.status === 'approved' && creds.hmacSecret && creds.userId, JSON.stringify(poll.body).slice(0, 80));

	const models = await req('GET', '/api/ai/models', { headers: signed(creds, 'GET', '/api/ai/models') });
	ck('signed models via proxy → 200', models.status === 200 && models.body.items && models.body.items.length === 13, `status ${models.status}`);

	const chat = await chatStream(creds);
	ck('chat SSE via proxy → 200 + text', chat.status === 200 && chat.text.length > 0, `status=${chat.status} frames=${chat.frames} err=${chat.err}`);
	ck('SSE streamed (multiple network chunks, not buffered)', chat.chunks >= 1 && chat.done, `chunks=${chat.chunks} done=${chat.done}`);
	console.log(`    assistant: ${JSON.stringify(chat.text.slice(0, 60))}  frames=${chat.frames} netChunks=${chat.chunks}`);

	console.log(`\n=== PROXY RESULT: ${pass} passed, ${fail} failed ===`);
	process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('CRASH', e); process.exit(2); });
