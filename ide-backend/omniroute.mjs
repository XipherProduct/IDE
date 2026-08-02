// Thin client for OmniRoute's OpenAI-compatible API.
// OmniRoute runs on the same box behind the basePath /admin/provider, so /v1
// lives at http://127.0.0.1:20128/admin/provider/v1. Loopback → no xpcore ACL.

import http from 'node:http';
import https from 'node:https';

const OMNI_BASE = process.env.OMNI_BASE || 'http://127.0.0.1:20128/admin/provider';
const OMNI_API_KEY = process.env.OMNI_API_KEY || ''; // optional Bearer for /v1

// Idle timeout for the streaming connection (ms). This is the gap BETWEEN bytes,
// not a total deadline — agentrouter/* models can take minutes to first token
// (upstream agent routing + big prompts), and Node's global fetch (undici) hard-
// caps headersTimeout/bodyTimeout at 300s, which was aborting those waits. Using
// node:http lets us set a generous idle window instead. Bump via OMNI_STREAM_IDLE_MS.
const STREAM_IDLE_MS = Number(process.env.OMNI_STREAM_IDLE_MS) || 900000; // 15 min

function omniHeaders(extra = {}) {
	const h = { 'Content-Type': 'application/json', ...extra };
	if (OMNI_API_KEY) h['Authorization'] = `Bearer ${OMNI_API_KEY}`;
	return h;
}

// GET the raw model catalog (used for diagnostics / validation).
export async function omniModels() {
	const r = await fetch(`${OMNI_BASE}/v1/models`, { headers: omniHeaders() });
	if (!r.ok) throw new Error(`OmniRoute /v1/models ${r.status}`);
	return r.json();
}

// Stream a chat completion. Yields parsed OpenAI SSE chunk objects
// (the parsed JSON after `data: `). Terminates on `[DONE]`.
//
// Implemented on node:http (not global fetch) so we own the idle timeout — see
// STREAM_IDLE_MS above. `signal` (from the request AbortController) still cancels.
export async function* omniChatStream(body, signal) {
	const url = new URL(`${OMNI_BASE}/v1/chat/completions`);
	const transport = url.protocol === 'https:' ? https : http;
	const payload = JSON.stringify({ ...body, stream: true });

	// Bridge Node's event-driven socket to an async generator via a small queue.
	const chunks = [];        // pending decoded text pieces
	let waiting = null;       // resolver when the consumer is ahead of the socket
	let done = false;         // stream ended cleanly (response 'end')
	let error = null;         // fatal error to surface to the consumer

	const push = piece => {
		if (piece) chunks.push(piece);
		if (waiting) { const w = waiting; waiting = null; w(); }
	};
	const finish = err => {
		if (err && !error) error = err;
		done = true;
		if (waiting) { const w = waiting; waiting = null; w(); }
	};

	const req = transport.request(url, {
		method: 'POST',
		headers: omniHeaders({ Accept: 'text/event-stream' }),
	});

	// Idle timeout: fires only when the socket goes quiet for STREAM_IDLE_MS,
	// so a slow first token or a mid-stream routing pause is tolerated, but a
	// genuinely dead connection still errors out rather than hanging forever.
	req.setTimeout(STREAM_IDLE_MS, () => {
		req.destroy(new Error(`OmniRoute stream idle for ${STREAM_IDLE_MS}ms`));
	});

	const onAbort = () => req.destroy(new Error('aborted'));
	if (signal) {
		if (signal.aborted) req.destroy(new Error('aborted'));
		else signal.addEventListener('abort', onAbort, { once: true });
	}

	const dec = new TextDecoder();

	req.on('response', res => {
		if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
			let detail = '';
			res.setEncoding('utf8');
			res.on('data', d => { if (detail.length < 300) detail += d; });
			res.on('end', () => {
				const err = new Error(`OmniRoute ${res.statusCode}: ${detail.slice(0, 300)}`);
				err.status = res.statusCode;
				finish(err);
			});
			return;
		}
		res.on('data', buf => push(dec.decode(buf, { stream: true })));
		res.on('end', () => finish(null));
		res.on('error', err => finish(err));
	});
	req.on('error', err => finish(err));
	req.end(payload);

	let buf = '';
	try {
		while (true) {
			if (chunks.length === 0 && !done) {
				await new Promise(resolve => { waiting = resolve; });
			}
			while (chunks.length) buf += chunks.shift();

			// SSE frames separated by newlines; process line by line.
			let nl;
			while ((nl = buf.indexOf('\n')) !== -1) {
				const line = buf.slice(0, nl).trim();
				buf = buf.slice(nl + 1);
				if (!line || !line.startsWith('data:')) continue;
				const payloadLine = line.slice(5).trim();
				if (payloadLine === '[DONE]') return;
				try { yield JSON.parse(payloadLine); }
				catch { /* skip non-json keepalives */ }
			}

			if (done) {
				if (error) throw error;
				return;
			}
		}
	} finally {
		if (signal) signal.removeEventListener('abort', onAbort);
		if (!req.destroyed) req.destroy();
	}
}
