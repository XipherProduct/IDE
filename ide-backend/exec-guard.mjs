// Single-source command + path guards, shared by the server (defense-in-depth,
// re-run before every dispatch) and vendored into the executor CLI at build so
// both ends enforce the identical policy. Zero-dep, no side effects.
//
// IMPORTANT: these are UX/defense filters, NOT the security boundary. The real
// boundary is OS-level confinement at the executor (a low-privilege process
// pinned to the project root). A denylist can always be worked around by a
// determined command; it exists to stop obvious footguns and honor read-only
// modes, and to fail closed when confinement is unavailable.

// ---- destructive-command denylist (verbatim from alaskaTools.ts) ------------

const RUN_COMMAND_DENY_RULES = [
	{ pattern: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+\/(?:\s|$|\*)/i, reason: 'rm -rf / would wipe the entire filesystem' },
	{ pattern: /\brm\s+-[a-z]*f[a-z]*r[a-z]*\s+\/(?:\s|$|\*)/i, reason: 'rm -fr / would wipe the entire filesystem' },
	{ pattern: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+\/\*/i, reason: 'rm -rf /* would wipe the entire filesystem' },
	{ pattern: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+~(?:\s|$|\/)/i, reason: 'rm -rf ~ would wipe the user home directory' },
	{ pattern: /--no-preserve-root/, reason: 'rm with --no-preserve-root removes the safety net against / wipes' },
	{ pattern: /\bmkfs(\.[a-z0-9]+)?\b/i, reason: 'mkfs would format a filesystem' },
	{ pattern: /\bdd\s+[^\n]*\bif\s*=\s*\/dev\/(?:zero|random|urandom)\s+[^\n]*\bof\s*=\s*\/dev\//i, reason: 'dd writing to a block device can destroy data' },
	{ pattern: /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:\s*&[^}]*\}\s*;\s*:/, reason: 'fork bomb pattern detected' },
	{ pattern: /\b(?:shutdown|reboot|halt|poweroff)\b/i, reason: 'system power commands are blocked' },
	{ pattern: /\binit\s+[06]\b/, reason: 'init 0/6 reboots or halts the system' },
	{ pattern: /\b(?:curl|wget|fetch|Invoke-WebRequest|iwr)\s+(?:-\S+\s+)*\S+\s*\|\s*(?:sh|bash|zsh|fish|pwsh|powershell|python\d?|perl|node|iex|Invoke-Expression)\b/i, reason: 'piping remote downloads into a shell is blocked' },
	{ pattern: /\bSet-ExecutionPolicy\s+(?:Unrestricted|Bypass)\b/i, reason: 'lowering PowerShell execution policy is blocked' },
	{ pattern: /\bsudo\s+(?:rm|mkfs|dd|shutdown|reboot|halt|poweroff)\b/i, reason: 'destructive command with sudo is blocked' },
];

// Returns { reason } if the command is denied, or undefined if allowed.
export function evaluateRunCommandDenial(command) {
	const c = String(command || '').trim();
	if (!c) { return { reason: 'empty command' }; }
	for (const rule of RUN_COMMAND_DENY_RULES) {
		if (rule.pattern.test(c)) { return { reason: rule.reason }; }
	}
	return undefined;
}

// ---- read-only command classification ---------------------------------------

const READ_ONLY_HEADS = new Set([
	'ls', 'dir', 'pwd', 'whoami', 'uname', 'hostname', 'echo',
	'cat', 'head', 'tail', 'less', 'more',
	'grep', 'rg', 'fd', 'tr', 'cut', 'wc', 'sort', 'uniq', 'comm',
	'which', 'where', 'stat', 'file', 'ps', 'df', 'du',
	'git', 'npm', 'pnpm', 'yarn', 'bun', 'cargo', 'go',
]);
const READ_ONLY_GIT = new Set(['status', 'log', 'diff', 'show', 'branch', 'remote', 'rev-parse', 'describe', 'tag', 'blame', 'ls-files', 'ls-tree', 'shortlog', 'reflog']);
const READ_ONLY_NODE = new Set(['list', 'ls', 'view', 'info', 'outdated', 'doctor']);
const READ_ONLY_CARGO_GO = new Set(['tree', 'metadata', 'version', 'help', 'list', 'vet']);
const CHAIN_OPERATORS = /(?:;|&&|\|\||\||>|<|`|\$\()/;

function head(command) { return (String(command).trim().split(/\s+/)[0] || '').replace(/^["']|["']$/g, ''); }
function sub(command, n = 1) {
	const parts = String(command).trim().split(/\s+/).filter(p => !p.startsWith('-'));
	return parts[n] || '';
}

export function isReadOnlyRunCommand(command) {
	if (CHAIN_OPERATORS.test(command)) { return false; }
	const h = head(command);
	if (!h) { return false; }
	if (h === 'git') { const s = sub(command); return !!s && READ_ONLY_GIT.has(s); }
	if (h === 'npm' || h === 'pnpm' || h === 'yarn' || h === 'bun') { const s = sub(command); return (h === 'npm' && s === 'run') || (!!s && READ_ONLY_NODE.has(s)); }
	if (h === 'cargo' || h === 'go') { const s = sub(command); return !!s && READ_ONLY_CARGO_GO.has(s); }
	if (h === 'sed') { return !/\s-i\b/.test(command); }
	return READ_ONLY_HEADS.has(h);
}

// ---- workspace path containment ---------------------------------------------

// Normalize a client-supplied workspace-relative path and reject escapes. This
// is the pre-flight filter; the executor additionally realpath's the resolved
// path against the jail root with O_NOFOLLOW to defeat symlink escapes.
// Returns { ok, path } or { ok:false, reason }.
export function safeRelPath(rel) {
	let p = String(rel ?? '').trim();
	if (!p) { return { ok: false, reason: 'empty path' }; }
	p = p.replace(/\\/g, '/');
	if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) { return { ok: false, reason: 'absolute paths are not allowed' }; }
	if (p.startsWith('~')) { return { ok: false, reason: 'home-relative paths are not allowed' }; }
	const segs = [];
	for (const seg of p.split('/')) {
		if (seg === '' || seg === '.') { continue; }
		if (seg === '..') { return { ok: false, reason: 'path traversal ("..") is not allowed' }; }
		segs.push(seg);
	}
	if (!segs.length) { return { ok: false, reason: 'empty path' }; }
	return { ok: true, path: segs.join('/') };
}
