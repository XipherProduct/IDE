// Embeddings + codebase index (RAG) + web tools for the IDE backend.
//
// Embeddings: no funded embedding model is available upstream, so we compute a
// deterministic LOCAL embedding (hashed token/bigram bag-of-words, L2-normalised).
// The IDE embeds both chunks and queries through this same endpoint, so the
// vector space is self-consistent and cosine similarity gives keyword-overlap
// retrieval. Swap `localEmbed` for a real model later without touching the index.
//
// Index: content is E2E-encrypted by the IDE; the backend only ever stores and
// returns { embedding, ciphertext, iv, file_path, start/end line, symbols } and
// ranks by cosine of the query vector. It never sees plaintext at rest.

import crypto from 'node:crypto';

const DIM = 384;

export function localEmbed(text) {
	const v = new Float64Array(DIM);
	const s = String(text || '').toLowerCase();
	const toks = s.match(/[a-z0-9_]+/g) || [];
	const bump = (tok) => {
		const h = crypto.createHash('md5').update(tok).digest();
		const idx = ((h[0] << 8) | h[1]) % DIM;
		const sign = (h[2] & 1) ? 1 : -1;
		v[idx] += sign;
	};
	for (let i = 0; i < toks.length; i++) {
		bump(toks[i]);
		if (i + 1 < toks.length) bump(toks[i] + '_' + toks[i + 1]); // bigram
	}
	let norm = 0;
	for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
	norm = Math.sqrt(norm) || 1;
	return Array.from(v, x => x / norm);
}

export function embeddings(inputs) {
	const arr = Array.isArray(inputs) ? inputs : [inputs];
	return { embeddings: arr.map(localEmbed) };
}

function cosine(a, b) {
	const n = Math.min(a.length, b.length);
	let dot = 0;
	for (let i = 0; i < n; i++) dot += a[i] * b[i];
	return dot; // both are L2-normalised → dot == cosine
}

// ---- index store (in-memory; the IDE re-indexes on reconnect) --------------
// key `${userId}:${workspace_id}` -> Map(chunkKey -> chunk)
const idx = new Map();
const wsKey = (userId, ws) => `${userId}:${ws}`;
const chunkKey = (c) => `${c.file_path}#${c.start_line}-${c.end_line}`;

export function indexUpsert(userId, workspace_id, chunks) {
	if (!workspace_id) return { written: 0 };
	const key = wsKey(userId, workspace_id);
	let m = idx.get(key);
	if (!m) { m = new Map(); idx.set(key, m); }
	let written = 0;
	for (const c of chunks || []) {
		if (!c || !Array.isArray(c.embedding)) continue;
		m.set(chunkKey(c), c);
		written++;
	}
	return { written };
}

export function indexSearch(userId, workspace_id, query, top_k = 20, file_filter) {
	const m = idx.get(wsKey(userId, workspace_id));
	if (!m || !Array.isArray(query)) return { hits: [] };
	const k = Math.min(Math.max(top_k | 0 || 20, 1), 50);
	const scored = [];
	for (const c of m.values()) {
		if (file_filter && !String(c.file_path).startsWith(file_filter)) continue;
		scored.push({
			file_path: c.file_path, start_line: c.start_line, end_line: c.end_line,
			symbol_name: c.symbol_name, symbol_kind: c.symbol_kind,
			ciphertext: c.ciphertext, iv: c.iv,
			score: cosine(query, c.embedding),
		});
	}
	scored.sort((a, b) => b.score - a.score);
	return { hits: scored.slice(0, k) };
}

export function indexStatus(userId, workspace_id) {
	const m = idx.get(wsKey(userId, workspace_id));
	const chunks = m ? m.size : 0;
	const files = new Set();
	if (m) for (const c of m.values()) files.add(c.file_path);
	return { workspace_id, indexed: chunks > 0, chunks, files: files.size, state: 'idle' };
}

export function indexDeleteWorkspace(userId, workspace_id) {
	idx.delete(wsKey(userId, workspace_id));
	return { deleted: true };
}

export function indexDeleteFile(userId, workspace_id, file_path) {
	const m = idx.get(wsKey(userId, workspace_id));
	if (!m) return { deleted: 0 };
	let n = 0;
	for (const key of [...m.keys()]) {
		if (m.get(key).file_path === file_path) { m.delete(key); n++; }
	}
	return { deleted: n };
}
