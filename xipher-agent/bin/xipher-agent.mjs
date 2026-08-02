#!/usr/bin/env node
// Xipher Code daemon. Pairs the current machine/project to a Xipher account, then
// serves the web agent's tool calls inside THIS project directory only.
//
//   npx xipher-agent pair <CODE>   # bind this project to your account (code from the web Code → Executors page)
//   npx xipher-agent               # run the daemon (after pairing)
//
// Config: XIPHER_BASE (default https://ide.xipher.pro/ide-api). Creds are stored
// in ./.xipher-agent.json (chmod 600) in the project root — add it to .gitignore.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { connect } from '../lib/wsclient.mjs';
import { execute, machineInfo } from '../lib/tools.mjs';

const BASE = (process.env.XIPHER_BASE || 'https://ide.xipher.pro/ide-api').replace(/\/$/, '');
const ROOT = process.cwd();
const CREDS_PATH = path.join(ROOT, '.xipher-agent.json');

function loadCreds() { try { return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')); } catch { return null; } }
function saveCreds(c) { fs.writeFileSync(CREDS_PATH, JSON.stringify(c, null, 2), { mode: 0o600 }); }
function log(...a) { console.log('[xipher-agent]', ...a); }

async function pair(code) {
	if (!code) { console.error('Usage: xipher-agent pair <CODE>   (get the code from the web Code → Executors page)'); process.exit(1); }
	const info = machineInfo();
	const r = await fetch(`${BASE}/api/agent/executors/pair-complete`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code: code.trim().toUpperCase(), name: `${info.name}:${path.basename(ROOT)}`, root: ROOT, os: info.os, caps: info.caps }),
	}).then(x => x.json()).catch(e => ({ ok: false, error: String(e) }));
	if (!r.ok) { console.error('Pairing failed:', r.error || 'unknown'); process.exit(1); }
	saveCreds({ executorId: r.executorId, secret: r.secret, kind: r.kind || 'local', base: BASE, wsPath: r.wsPath || '/executor/ws', root: ROOT });
	log(`✓ Paired. This project (${ROOT}) is now available in your Xipher account.`);
	log('Now run:  xipher-agent   (keep it running to let the web agent work here)');
}

function helloSig(secretHex, executorId, nonce, bodyHash) {
	return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update(`${executorId}\n${nonce}\n${bodyHash}`).digest('hex');
}
function bodyHashOf(fields) { return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex'); }

function run() {
	const creds = loadCreds();
	if (!creds) { console.error('Not paired. Run:  xipher-agent pair <CODE>'); process.exit(1); }
	const info = machineInfo();
	const wsUrl = creds.base.replace(/^http/, 'ws') + (creds.wsPath || '/executor/ws');
	let backoff = 1000;

	const start = () => {
		log(`connecting to ${wsUrl} …`);
		let sock;
		sock = connect(wsUrl, {
			onMessage: raw => {
				let msg; try { msg = JSON.parse(raw); } catch { return; }
				if (msg.type === 'challenge') {
					const fields = { kind: creds.kind || 'local', os: info.os, root: creds.root || ROOT, caps: info.caps };
					const sig = helloSig(creds.secret, creds.executorId, msg.nonce, bodyHashOf(fields));
					sock.send({ type: 'hello', executorId: creds.executorId, name: `${info.name}:${path.basename(creds.root || ROOT)}`, ...fields, sig });
					return;
				}
				if (msg.type === 'welcome') { backoff = 1000; log('✓ online — waiting for tasks. Ctrl-C to stop.'); return; }
				if (msg.type === 'error') { log('server error:', msg.code); return; }
				if (msg.type === 'rpc') {
					const t0 = Date.now();
					execute(msg.op, msg.args, creds.root || ROOT).then(res => {
						log(`${msg.op} → ${res.ok ? 'ok' : 'fail'} (${Date.now() - t0}ms)`);
						sock.send({ type: 'reply', callId: msg.callId, ok: res.ok, content: res.content, edit: res.edit });
					});
					return;
				}
			},
			onClose: () => { log(`disconnected — reconnecting in ${Math.round(backoff / 1000)}s`); setTimeout(start, backoff); backoff = Math.min(backoff * 1.8, 15000); },
			onError: e => { log('ws error:', e.message); },
		});
	};
	start();
	process.on('SIGINT', () => { log('bye'); process.exit(0); });
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'pair') { void pair(arg); }
else if (cmd === 'run' || cmd === undefined) { run(); }
else { console.error(`Unknown command: ${cmd}\nUsage: xipher-agent [pair <CODE>|run]`); process.exit(1); }
