// Executor abstraction — the thing the agent loop dispatches tool calls to.
//
// An Executor turns a tool call (name + parsed args + ctx) into a result
// { ok, content, edit? }. This indirection is the seam the whole platform pivots
// on: Phase 1 ships the built-in ServerExecutor (real web/egress tools + an echo
// stand-in for workspace tools); Phase 2 adds a local daemon and SSH executor;
// Phase 3 adds an IDE-relay executor — all behind this identical interface.
//
// Web/egress tools run HERE, in the backend's own (SSRF-hardened) namespace, for
// every executor kind: they need server-side API keys and must never touch the
// user's machine. Workspace tools (read/write/patch/delete/grep/ls/run) are
// dispatched to the workspace-bound executor; the ServerExecutor has no real
// workspace, so it echoes them — enough to prove the spine end-to-end.

import { webSearch, webFetch } from './web.mjs';
import { evaluateRunCommandDenial, isReadOnlyRunCommand, safeRelPath } from './exec-guard.mjs';
import * as executors from './executors.mjs';

const WORKSPACE_OPS = new Set([
	'alaska_read_file', 'alaska_write_file', 'alaska_patch_file', 'alaska_delete_file',
	'alaska_grep_search', 'alaska_list_directory', 'alaska_run_command',
]);

// Run the web/egress tools that live on the backend regardless of executor kind.
// Returns a result, or null if `name` is not a web tool (caller falls through to
// the workspace executor).
async function dispatchWebTool(name, args, ctx) {
	if (name === 'alaska_web_search') {
		const r = await webSearch(args.query, {
			max_results: args.max_results, freshness: args.freshness, site_filter: args.site_filter, provider: args.provider,
		}, ctx.userId, ctx.planId);
		if (r.code === 'web_search_quota_exhausted') { return { ok: false, content: r.error }; }
		return { ok: true, content: formatSearch(r) };
	}
	if (name === 'alaska_web_fetch') {
		const r = await webFetch(args.url, { format: args.format, max_bytes: args.max_bytes }, ctx.userId, ctx.planId);
		if (r.error) { return { ok: false, content: r.error }; }
		const head = `# ${r.title || r.final_url}\n${r.final_url} · ${r.status_code} · ${r.byte_count}B${r.truncated ? ' (truncated)' : ''}\n\n`;
		return { ok: true, content: head + r.content };
	}
	if (name === 'alaska_open_browser') {
		// UX-only: the client opens the URL in its own view. No backend egress.
		return { ok: true, content: `Opened ${args.url} in the browser panel.` };
	}
	return null;
}

function formatSearch(r) {
	if (!r.hits || !r.hits.length) { return `No results (provider: ${r.provider || 'none'}).`; }
	return r.hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`).join('\n\n');
}

// ---- Executor: server-side (echo workspace tools) ---------------------------

class ServerExecutor {
	constructor() { this.kind = 'echo'; }
	get available() { return true; }

	async dispatch(name, args, ctx) {
		const web = await dispatchWebTool(name, args, ctx);
		if (web) { return web; }
		if (!WORKSPACE_OPS.has(name)) { return { ok: false, content: `Unknown tool: ${name}` }; }
		return this.echoWorkspace(name, args);
	}

	// Stand-in for a real workspace. Validates args through the same guards a real
	// executor uses (so the loop exercises the guard path), then echoes intent.
	echoWorkspace(name, args) {
		if (name === 'alaska_run_command') {
			const denial = evaluateRunCommandDenial(args.command);
			if (denial) { return { ok: false, content: `Refused: ${denial.reason}` }; }
			const ro = isReadOnlyRunCommand(args.command) ? ' (read-only)' : '';
			return { ok: true, content: `[echo executor] Would run${ro}: ${args.command}\n(No workspace is attached to this session — pair a local daemon or SSH host to run commands for real.)` };
		}
		if (name === 'alaska_grep_search') {
			return { ok: true, content: `[echo executor] Would grep for "${args.pattern}". Attach a workspace to search real files.` };
		}
		if (name === 'alaska_list_directory') {
			return { ok: true, content: `[echo executor] Would list "${args.path || '.'}". Attach a workspace to browse real files.` };
		}
		// file ops: path-jail check, then echo
		const rel = safeRelPath(args.path);
		if (!rel.ok) { return { ok: false, content: `Refused: ${rel.reason}` }; }
		if (name === 'alaska_read_file') {
			return { ok: true, content: `[echo executor] Would read ${rel.path}. Attach a workspace to read real files.` };
		}
		if (name === 'alaska_write_file') {
			return {
				ok: true,
				content: `[echo executor] Would write ${rel.path} (${Buffer.byteLength(args.content || '', 'utf8')} bytes).`,
				edit: { action: 'create', path: rel.path, content: args.content || '' },
			};
		}
		if (name === 'alaska_patch_file') {
			return {
				ok: true,
				content: `[echo executor] Would patch ${rel.path}.`,
				edit: { action: 'patch', path: rel.path, find: args.find, newSnippet: args.replace },
			};
		}
		if (name === 'alaska_delete_file') {
			return { ok: true, content: `[echo executor] Would delete ${rel.path}.`, edit: { action: 'delete', path: rel.path } };
		}
		return { ok: false, content: `Unhandled workspace op: ${name}` };
	}
}

const serverExecutor = new ServerExecutor();

// Executor bound to a paired daemon / SSH host. Web/egress tools still run on the
// backend; workspace tools are dispatched to the real machine over the executor
// WS RPC. Ownership is re-checked inside executors.dispatch (executor.userId).
class RemoteExecutor {
	constructor(kind, executorId) { this.kind = kind; this.executorId = executorId; }
	get available() { return executors.isOnline(this.executorId); }

	async dispatch(name, args, ctx) {
		const web = await dispatchWebTool(name, args, ctx);
		if (web) { return web; }
		if (!WORKSPACE_OPS.has(name)) { return { ok: false, content: `Unknown tool: ${name}` }; }
		// defense-in-depth: re-run the guards server-side before shipping the op
		if (name === 'alaska_run_command') {
			const denial = evaluateRunCommandDenial(args.command);
			if (denial) { return { ok: false, content: `Refused: ${denial.reason}` }; }
		} else if (name !== 'alaska_grep_search' && name !== 'alaska_list_directory') {
			const rel = safeRelPath(args.path);
			if (!rel.ok) { return { ok: false, content: `Refused: ${rel.reason}` }; }
		}
		const timeoutMs = name === 'alaska_run_command' ? 30 * 60_000 : 180_000;
		return executors.dispatch(ctx.userId, this.executorId, name, args, { timeoutMs });
	}
}

// Resolve the executor for a session by its workspace binding.
//   local/ssh + a bound executorId → RemoteExecutor (real machine, RPC over WS)
//   everything else               → ServerExecutor (web tools + echoed workspace)
export function resolveExecutor(session) {
	const kind = session?.workspace?.kind;
	const ref = session?.workspace?.ref;
	// local daemon, SSH-host daemon, and a live desktop IDE all speak the same
	// executor RPC — only the pairing/registration path differs.
	if ((kind === 'local' || kind === 'ssh' || kind === 'ide') && ref) { return new RemoteExecutor(kind, ref); }
	return serverExecutor;
}

export { serverExecutor };
