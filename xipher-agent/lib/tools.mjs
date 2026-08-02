// Tool handlers executed on the paired machine, inside the project root only.
// Every path is contained via realpath so a symlink can't escape the jail, and
// commands are re-checked against the shared deny-rules before running.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { evaluateRunCommandDenial, safeRelPath } from './exec-guard.mjs';

const MAX_READ_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024;
const CMD_TIMEOUT_MS = 30 * 60_000;
const EXCLUDES = new Set(['node_modules', '.git', 'out', 'dist', 'build', 'vendor', 'target', '__pycache__', '.next', '.cache']);

// Resolve a workspace-relative path inside the jail. Rejects traversal + symlink
// escapes (realpath the deepest existing ancestor and confirm it's under root).
function resolveInRoot(root, rel) {
	const g = safeRelPath(rel);
	if (!g.ok) { throw new Error(g.reason); }
	const abs = path.resolve(root, g.path);
	const realRoot = fs.realpathSync(root);
	let probe = abs;
	while (true) {
		if (fs.existsSync(probe)) {
			const real = fs.realpathSync(probe);
			const rp = real === realRoot ? real : real + path.sep;
			if (real !== realRoot && !real.startsWith(realRoot + path.sep)) { throw new Error('path escapes the project root'); }
			// re-append the not-yet-existing tail
			const tail = path.relative(probe, abs);
			return tail ? path.join(real, tail) : real;
		}
		const parent = path.dirname(probe);
		if (parent === probe) { break; }
		probe = parent;
	}
	return abs;
}

async function readFile(root, args) {
	const p = resolveInRoot(root, args.path);
	const st = await fsp.stat(p);
	if (!st.isFile()) { return { ok: false, content: 'not a file' }; }
	let text = await fsp.readFile(p, 'utf8');
	const lines = text.split('\n');
	const total = lines.length;
	const offset = Math.max(1, Number(args.offset) || 1);
	const limit = Number(args.limit) || (total - offset + 1);
	const slice = lines.slice(offset - 1, offset - 1 + limit);
	let out = slice.map((l, i) => `${offset + i}\t${l}`).join('\n');
	let truncated = false;
	if (Buffer.byteLength(out, 'utf8') > MAX_READ_BYTES) { out = Buffer.from(out, 'utf8').subarray(0, MAX_READ_BYTES).toString('utf8'); truncated = true; }
	return { ok: true, content: `${out}${truncated ? '\n… [truncated]' : ''}\n\n(total_lines: ${total})` };
}

async function writeFile(root, args) {
	const p = resolveInRoot(root, args.path);
	await fsp.mkdir(path.dirname(p), { recursive: true });
	const existed = fs.existsSync(p);
	await fsp.writeFile(p, args.content ?? '', 'utf8');
	return { ok: true, content: `${existed ? 'Updated' : 'Created'} ${args.path} (${Buffer.byteLength(args.content || '', 'utf8')} bytes).`, edit: { action: existed ? 'replace' : 'create', path: args.path, content: args.content ?? '' } };
}

async function patchFile(root, args) {
	const p = resolveInRoot(root, args.path);
	let text = await fsp.readFile(p, 'utf8');
	const find = args.find ?? '';
	if (!find) { return { ok: false, content: 'find is required' }; }
	const count = text.split(find).length - 1;
	if (count === 0) { return { ok: false, content: 'find-string not found (read the file first so it matches exact bytes)' }; }
	if (count > 1 && !args.replace_all) { return { ok: false, content: `find-string matches ${count} places — add context to make it unique or set replace_all:true` }; }
	text = args.replace_all ? text.split(find).join(args.replace ?? '') : text.replace(find, args.replace ?? '');
	await fsp.writeFile(p, text, 'utf8');
	return { ok: true, content: `Patched ${args.path} (${count} occurrence${count > 1 ? 's' : ''}).`, edit: { action: 'patch', path: args.path, find, newSnippet: args.replace ?? '' } };
}

async function deleteFile(root, args) {
	const p = resolveInRoot(root, args.path);
	await fsp.rm(p, { force: true });
	return { ok: true, content: `Deleted ${args.path}.`, edit: { action: 'delete', path: args.path } };
}

async function listDirectory(root, args) {
	const rel = args.path && args.path !== '.' ? safeRelPath(args.path) : { ok: true, path: '' };
	if (!rel.ok) { return { ok: false, content: rel.reason }; }
	const base = resolveInRoot(root, rel.path || '.');
	const depth = Math.min(4, Math.max(0, Number(args.depth) ?? 1));
	const lines = [];
	let count = 0;
	const walk = async (dir, prefix, d) => {
		let entries;
		try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
		entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
		for (const e of entries) {
			if (count >= 500) { lines.push(`${prefix}… [truncated]`); return; }
			if (!args.include_hidden && e.name.startsWith('.')) { continue; }
			if (EXCLUDES.has(e.name)) { lines.push(`${prefix}${e.name}/  (excluded)`); continue; }
			count++;
			if (e.isDirectory()) {
				lines.push(`${prefix}${e.name}/`);
				if (d < depth) { await walk(path.join(dir, e.name), prefix + '  ', d + 1); }
			} else {
				let size = 0; try { size = (await fsp.stat(path.join(dir, e.name))).size; } catch { /* ignore */ }
				lines.push(`${prefix}${e.name}  (${size}b)`);
			}
		}
	};
	await walk(base, '', 0);
	return { ok: true, content: lines.join('\n') || '(empty)' };
}

async function grepSearch(root, args) {
	const pattern = String(args.pattern || '');
	if (!pattern) { return { ok: false, content: 'pattern required' }; }
	const maxResults = Math.min(500, Number(args.max_results) || 100);
	// prefer ripgrep if present
	if (hasRg()) {
		const rgArgs = ['--line-number', '--no-heading', '--color', 'never', '-m', String(maxResults)];
		if (!args.regex) { rgArgs.push('-F'); }
		if (args.case_sensitive === false) { rgArgs.push('-i'); }
		if (args.include) { rgArgs.push('-g', args.include); }
		if (args.exclude) { rgArgs.push('-g', '!' + args.exclude); }
		rgArgs.push('--', pattern, args.path ? resolveInRoot(root, args.path) : root);
		const r = spawnSync('rg', rgArgs, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
		const out = (r.stdout || '').split('\n').filter(Boolean).slice(0, maxResults).map(l => l.replace(root + path.sep, '')).join('\n');
		return { ok: true, content: out || '(no matches)' };
	}
	// JS fallback (literal only)
	const hits = [];
	const needle = args.case_sensitive === false ? pattern.toLowerCase() : pattern;
	const scan = async dir => {
		if (hits.length >= maxResults) { return; }
		let entries; try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
		for (const e of entries) {
			if (hits.length >= maxResults) { return; }
			if (e.name.startsWith('.') || EXCLUDES.has(e.name)) { continue; }
			const full = path.join(dir, e.name);
			if (e.isDirectory()) { await scan(full); }
			else {
				let text; try { text = await fsp.readFile(full, 'utf8'); } catch { continue; }
				text.split('\n').forEach((line, i) => {
					if (hits.length >= maxResults) { return; }
					const hay = args.case_sensitive === false ? line.toLowerCase() : line;
					if (hay.includes(needle)) { hits.push(`${path.relative(root, full)}:${i + 1}:${line.trim().slice(0, 200)}`); }
				});
			}
		}
	};
	await scan(args.path ? resolveInRoot(root, args.path) : root);
	return { ok: true, content: hits.join('\n') || '(no matches)' };
}

let _rg;
function hasRg() { if (_rg === undefined) { _rg = spawnSync('rg', ['--version'], { encoding: 'utf8' }).status === 0; } return _rg; }

function runCommand(root, args) {
	const denial = evaluateRunCommandDenial(args.command);
	if (denial) { return Promise.resolve({ ok: false, content: `Refused: ${denial.reason}` }); }
	let cwd = root;
	if (args.cwd) { try { cwd = resolveInRoot(root, args.cwd); } catch (e) { return Promise.resolve({ ok: false, content: String(e.message) }); } }
	const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
	const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', args.command] : ['-c', args.command];
	// scrubbed, minimal environment (no inherited secrets beyond PATH/HOME/lang)
	const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, TERM: 'dumb', USER: process.env.USER };
	return new Promise(resolve => {
		const started = Date.now();
		let out = ''; let size = 0; let done = false;
		const child = spawn(shell, shellArgs, { cwd, env, windowsHide: true });
		const cap = c => { size += c.length; if (out.length < MAX_OUTPUT_BYTES * 4) { out += c.toString('utf8'); } };
		child.stdout.on('data', cap);
		child.stderr.on('data', cap);
		const timer = setTimeout(() => { if (!done) { child.kill('SIGKILL'); } }, CMD_TIMEOUT_MS);
		child.on('error', e => { if (!done) { done = true; clearTimeout(timer); resolve({ ok: false, content: `spawn error: ${e.message}` }); } });
		child.on('close', code => {
			if (done) { return; }
			done = true; clearTimeout(timer);
			const tail = out.length > MAX_OUTPUT_BYTES ? out.slice(-MAX_OUTPUT_BYTES) : out;
			resolve({ ok: code === 0, content: JSON.stringify({ ok: code === 0, exit_code: code, output_tail: tail, full_size: size, truncated: size > MAX_OUTPUT_BYTES, duration_ms: Date.now() - started, shell: path.basename(shell) }) });
		});
	});
}

const HANDLERS = {
	alaska_read_file: readFile,
	alaska_write_file: writeFile,
	alaska_patch_file: patchFile,
	alaska_delete_file: deleteFile,
	alaska_list_directory: listDirectory,
	alaska_grep_search: grepSearch,
	alaska_run_command: runCommand,
};

// Execute one tool op. Returns { ok, content, edit? }.
export async function execute(op, args, root) {
	const h = HANDLERS[op];
	if (!h) { return { ok: false, content: `unsupported op: ${op}` }; }
	try { return await h(root, args || {}); }
	catch (e) { return { ok: false, content: `error: ${String(e && e.message || e)}` }; }
}

export function machineInfo() {
	return { name: os.hostname(), os: `${process.platform} ${os.release()}`, caps: ['fs', 'run', hasRg() ? 'rg' : 'js-grep'] };
}
