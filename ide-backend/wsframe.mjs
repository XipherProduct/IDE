// Minimal shared RFC6455 helpers (zero-dep), used by the browser relay
// (agentApi) and the executor channel (executor-ws). Server side only:
// encodes unmasked server→client frames and reads masked client→server frames.

import crypto from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export function acceptKey(key) { return crypto.createHash('sha1').update(key + WS_GUID).digest('base64'); }

// Complete the upgrade handshake on a raw socket.
export function completeUpgrade(socket, key) {
	socket.write(
		'HTTP/1.1 101 Switching Protocols\r\n' +
		'Upgrade: websocket\r\n' +
		'Connection: Upgrade\r\n' +
		`Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
	);
}

export function abortUpgrade(socket, code, msg) {
	try { socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\n\r\n`); } catch { /* ignore */ }
	try { socket.destroy(); } catch { /* ignore */ }
}

// Encode a server→client frame (unmasked). opcode 0x1=text, 0x8=close, 0x9=ping, 0xA=pong.
export function encodeFrame(str, opcode = 0x1) {
	const payload = Buffer.from(str, 'utf8');
	const len = payload.length;
	let header;
	if (len < 126) { header = Buffer.alloc(2); header[1] = len; }
	else if (len < 65536) { header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(len, 2); }
	else { header = Buffer.alloc(10); header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
	header[0] = 0x80 | opcode;
	return Buffer.concat([header, payload]);
}

// Attach aframing reader to a socket. Calls handlers.onText(str) for text frames,
// handles ping→pong + close, enforces the mask requirement + a frame-size cap.
// Returns { send(obj|str), close() }.
export function attachSocket(socket, handlers = {}) {
	const maxFrame = handlers.maxFrame || 4 * 1024 * 1024;
	let buf = Buffer.alloc(0);
	let closed = false;

	const send = data => {
		if (closed) { return; }
		const str = typeof data === 'string' ? data : JSON.stringify(data);
		try { socket.write(encodeFrame(str)); } catch { /* ignore */ }
	};
	const close = () => {
		if (closed) { return; }
		closed = true;
		try { handlers.onClose?.(); } catch { /* ignore */ }
	};
	socket.on('close', close);
	socket.on('error', close);

	if (handlers.ping !== false) {
		const t = setInterval(() => { if (!closed) { try { socket.write(encodeFrame('', 0x9)); } catch { /* ignore */ } } }, handlers.pingMs || 30_000);
		t.unref?.();
		socket.on('close', () => clearInterval(t));
	}

	socket.on('data', chunk => {
		buf = Buffer.concat([buf, chunk]);
		while (buf.length >= 2) {
			const b0 = buf[0], b1 = buf[1];
			const opcode = b0 & 0x0f;
			const masked = (b1 & 0x80) !== 0;
			let len = b1 & 0x7f;
			let offset = 2;
			if (len === 126) { if (buf.length < 4) { return; } len = buf.readUInt16BE(2); offset = 4; }
			else if (len === 127) { if (buf.length < 10) { return; } len = Number(buf.readBigUInt64BE(2)); offset = 10; }
			if (len > maxFrame) { socket.destroy(); close(); return; }
			if (!masked) { socket.destroy(); close(); return; } // client frames MUST be masked
			if (buf.length < offset + 4 + len) { return; }
			const mask = buf.subarray(offset, offset + 4);
			const payload = buf.subarray(offset + 4, offset + 4 + len);
			const data = Buffer.alloc(len);
			for (let i = 0; i < len; i++) { data[i] = payload[i] ^ mask[i & 3]; }
			buf = buf.subarray(offset + 4 + len);

			if (opcode === 0x8) { close(); try { socket.end(encodeFrame('', 0x8)); } catch { /* ignore */ } return; }
			if (opcode === 0x9) { try { socket.write(encodeFrame(data.toString('utf8'), 0xA)); } catch { /* ignore */ } continue; }
			if (opcode === 0xA) { continue; }
			if (opcode === 0x1 || opcode === 0x0) { try { handlers.onText?.(data.toString('utf8')); } catch { /* ignore */ } continue; }
		}
	});

	return { send, close };
}
