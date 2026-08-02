// Static file serving for the built SPA (Vite dist copied to ./public), with
// SPA fallback: unknown non-/api paths return index.html so hash/deep links work.
// Path-traversal safe.

import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(process.cwd(), 'public');

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
	'.webp': 'image/webp', '.ico': 'image/x-icon', '.gif': 'image/gif',
	'.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
	'.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

export function hasPublic() {
	try { return fs.existsSync(path.join(PUBLIC_DIR, 'index.html')); } catch { return false; }
}

function safeResolve(urlPath) {
	const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\0/g, '');
	const resolved = path.join(PUBLIC_DIR, path.normalize(clean));
	// must stay inside PUBLIC_DIR
	if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) { return null; }
	return resolved;
}

function sendFile(res, file, status = 200) {
	const ext = path.extname(file).toLowerCase();
	const type = TYPES[ext] || 'application/octet-stream';
	const body = fs.readFileSync(file);
	const headers = { 'Content-Type': type, 'Content-Length': body.length };
	// hashed Vite assets are immutable; index.html must never be cached
	if (/\/assets\//.test(file) && ext !== '.html') { headers['Cache-Control'] = 'public, max-age=31536000, immutable'; }
	else { headers['Cache-Control'] = 'no-cache'; }
	res.writeHead(status, headers);
	res.end(body);
}

// Returns true if it handled the request.
export function serveStatic(req, res) {
	if (!hasPublic()) { return false; }
	const urlPath = req.url.split('?')[0];

	// try the exact file first
	const resolved = safeResolve(urlPath === '/' ? '/index.html' : urlPath);
	if (resolved) {
		try {
			const st = fs.statSync(resolved);
			if (st.isFile()) { sendFile(res, resolved); return true; }
		} catch { /* fall through to SPA fallback */ }
	}

	// SPA fallback for GET/HEAD non-asset paths → index.html
	if ((req.method === 'GET' || req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(urlPath)) {
		const index = path.join(PUBLIC_DIR, 'index.html');
		if (fs.existsSync(index)) { sendFile(res, index); return true; }
	}
	return false;
}
