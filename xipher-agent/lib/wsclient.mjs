// Minimal zero-dep RFC6455 WebSocket client (browser-side masking). Enough for
// the daemon to talk to the Xipher executor channel; no ws npm dependency.

import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

export function connect(urlStr, { onOpen, onMessage, onClose, onError } = {}) {
	const u = new URL(urlStr);
	const isTls = u.protocol === 'wss:';
	const transport = isTls ? https : http;
	const key = crypto.randomBytes(16).toString('base64');

	const req = transport.request({
		host: u.hostname,
		port: u.port || (isTls ? 443 : 80),
		path: (u.pathname || '/') + (u.search || ''),
		method: 'GET',
		headers: {
			Connection: 'Upgrade', Upgrade: 'websocket',
			'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13',
			Host: u.host,
		},
	});

	let closed = false;
	const api = {
		send(data) {
			if (closed || !api._socket) { return; }
			const str = typeof data === 'string' ? data : JSON.stringify(data);
			try { api._socket.write(encodeClientFrame(str)); } catch { /* ignore */ }
		},
		close() { closed = true; try { api._socket?.end(encodeClientFrame('', 0x8)); } catch { /* ignore */ } try { api._socket?.destroy(); } catch { /* ignore */ } },
		_socket: null,
	};

	req.on('upgrade', (res, socket) => {
		api._socket = socket;
		let buf = Buffer.alloc(0);
		onOpen?.();
		socket.on('data', chunk => {
			buf = Buffer.concat([buf, chunk]);
			while (buf.length >= 2) {
				const opcode = buf[0] & 0x0f;
				const masked = (buf[1] & 0x80) !== 0;
				let len = buf[1] & 0x7f; let off = 2;
				if (len === 126) { if (buf.length < 4) { return; } len = buf.readUInt16BE(2); off = 4; }
				else if (len === 127) { if (buf.length < 10) { return; } len = Number(buf.readBigUInt64BE(2)); off = 10; }
				const maskLen = masked ? 4 : 0;
				if (buf.length < off + maskLen + len) { return; }
				let payload = buf.subarray(off + maskLen, off + maskLen + len);
				if (masked) { const m = buf.subarray(off, off + 4); const d = Buffer.alloc(len); for (let i = 0; i < len; i++) { d[i] = payload[i] ^ m[i & 3]; } payload = d; }
				buf = buf.subarray(off + maskLen + len);
				if (opcode === 0x8) { closed = true; try { socket.destroy(); } catch { /* ignore */ } onClose?.(); return; }
				if (opcode === 0x9) { try { socket.write(encodeClientFrame(payload.toString('utf8'), 0xA)); } catch { /* ignore */ } continue; } // ping→pong
				if (opcode === 0xA) { continue; }
				if (opcode === 0x1 || opcode === 0x0) { try { onMessage?.(payload.toString('utf8')); } catch { /* ignore */ } }
			}
		});
		socket.on('close', () => { if (!closed) { closed = true; onClose?.(); } });
		socket.on('error', e => { onError?.(e); });
	});
	req.on('error', e => { onError?.(e); });
	req.end();
	return api;
}

// Client→server frames MUST be masked (RFC6455 §5.3).
function encodeClientFrame(str, opcode = 0x1) {
	const payload = Buffer.from(str, 'utf8');
	const len = payload.length;
	const mask = crypto.randomBytes(4);
	let header;
	if (len < 126) { header = Buffer.alloc(2); header[1] = 0x80 | len; }
	else if (len < 65536) { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
	else { header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
	header[0] = 0x80 | opcode;
	const masked = Buffer.alloc(len);
	for (let i = 0; i < len; i++) { masked[i] = payload[i] ^ mask[i & 3]; }
	return Buffer.concat([header, mask, masked]);
}
