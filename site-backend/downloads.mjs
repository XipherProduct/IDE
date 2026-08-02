// Desktop-IDE distributables: a JSON manifest + a streaming file endpoint.
//
// Files live in DOWNLOADS_DIR (outside ./public, so a frontend redeploy can't
// clobber them). They are streamed with HTTP Range support so 200–400 MB
// downloads are resumable and never buffered whole into memory (unlike the SPA
// static server). Only files whitelisted in CATALOG are servable.

import fs from 'node:fs';
import path from 'node:path';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(process.cwd(), 'downloads');
export const IDE_VERSION = process.env.IDE_VERSION || '1.119.32';

// id → file on disk + presentation. Array order is display order.
const CATALOG = [
	{ id: 'win-setup',    file: 'XipherIDE-Setup-x64.exe',         os: 'windows', ext: 'exe',
	  kind: 'Установщик',  label: 'Windows · установщик',  hint: 'Ярлыки, установка без прав администратора. Рекомендуется.', recommended: true },
	{ id: 'win-portable', file: 'Xipher-IDE-win-x64-portable.zip', os: 'windows', ext: 'zip',
	  kind: 'Portable',    label: 'Windows · portable',    hint: 'Распакуйте архив и запустите — без установки.' },
	{ id: 'linux',        file: 'Xipher_IDE-x86_64.AppImage',      os: 'linux',   ext: 'AppImage',
	  kind: 'AppImage',    label: 'Linux · AppImage',      hint: 'chmod +x и запуск. Архитектура x86-64.' },
];

function human(n) {
	if (n >= 1073741824) { return (n / 1073741824).toFixed(1).replace(/\.0$/, '') + ' ГБ'; }
	if (n >= 1048576) { return Math.round(n / 1048576) + ' МБ'; }
	if (n >= 1024) { return Math.round(n / 1024) + ' КБ'; }
	return n + ' Б';
}

function meta(item) {
	const full = path.join(DOWNLOADS_DIR, item.file);
	try {
		const st = fs.statSync(full);
		if (st.isFile()) {
			return { ...item, available: true, size: st.size, sizeh: human(st.size),
				url: '/download/' + encodeURIComponent(item.file), updatedAt: st.mtimeMs };
		}
	} catch { /* not present yet */ }
	return { ...item, available: false, size: 0, sizeh: '—', url: null, updatedAt: 0 };
}

export function downloadsManifest() {
	return { version: IDE_VERSION, items: CATALOG.map(meta) };
}

const MIME = {
	exe: 'application/vnd.microsoft.portable-executable',
	zip: 'application/zip',
	AppImage: 'application/x-executable',
};

// GET|HEAD /download/<file>. Returns true once it has written a response.
export function serveDownload(req, res, fileName) {
	const item = CATALOG.find(c => c.file === fileName);
	if (!item) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"not_found"}'); return true; }

	const full = path.join(DOWNLOADS_DIR, item.file);
	let st;
	try { st = fs.statSync(full); if (!st.isFile()) { throw new Error('not a file'); } }
	catch { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"unavailable"}'); return true; }

	const type = MIME[item.ext] || 'application/octet-stream';
	const disp = `attachment; filename="${item.file}"`;
	const total = st.size;
	const base = {
		'Content-Type': type,
		'Content-Disposition': disp,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'public, max-age=3600',
		'Last-Modified': new Date(st.mtimeMs).toUTCString(),
	};

	const range = req.headers.range;
	if (range) {
		const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
		if (m && (m[1] !== '' || m[2] !== '')) {
			let start, end;
			if (m[1] === '') { // suffix: last N bytes
				const n = parseInt(m[2], 10);
				start = Math.max(0, total - n); end = total - 1;
			} else {
				start = parseInt(m[1], 10);
				end = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
			}
			if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
				res.writeHead(416, { 'Content-Range': `bytes */${total}` }); res.end(); return true;
			}
			res.writeHead(206, { ...base, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${total}` });
			if (req.method === 'HEAD') { res.end(); return true; }
			fs.createReadStream(full, { start, end }).on('error', () => res.destroy()).pipe(res);
			return true;
		}
	}

	res.writeHead(200, { ...base, 'Content-Length': total });
	if (req.method === 'HEAD') { res.end(); return true; }
	fs.createReadStream(full).on('error', () => res.destroy()).pipe(res);
	return true;
}
