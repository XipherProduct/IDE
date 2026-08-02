// Tool schemas for the server-side agent loop, in OpenAI function-calling shape.
//
// Names mirror the desktop IDE's TOOL_DEFINITIONS (alaskaTools.ts) so a session
// can later be relayed to a live desktop IDE (Phase 3) and the same tool calls
// dispatch there unchanged. `toolsForMode` gates the exposed set by agent mode
// and permission mode (Plan / Read-only expose read-only tools only).

export const READ_ONLY_TOOLS = new Set([
	'alaska_read_file', 'alaska_grep_search', 'alaska_list_directory',
	'alaska_web_search', 'alaska_web_fetch', 'alaska_open_browser',
]);

// Tools that mutate the workspace or run commands — gated behind approval in
// permission modes that require it, and blocked entirely in Plan / Read-only.
export const MUTATING_TOOLS = new Set([
	'alaska_write_file', 'alaska_patch_file', 'alaska_delete_file', 'alaska_run_command',
]);

const T = (name, description, parameters) => ({ type: 'function', function: { name, description, parameters } });
const obj = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });

export const TOOL_DEFINITIONS = [
	T('alaska_read_file',
		'Read a workspace file. Output is line-numbered as `<n>\\t<line>` — the number is a REFERENCE only and must NOT be included in an alaska_patch_file `find`. Read BEFORE patching so your find-string matches exact bytes. For large files, pass offset (1-based start line) and limit (line count) to read a window; the result reports total_lines.',
		obj({
			path: { type: 'string', description: 'Workspace-relative path.' },
			offset: { type: 'number', description: '1-based line to start from. Optional; default 1.' },
			limit: { type: 'number', description: 'Max lines to read. Optional; default to end of file.' },
		}, ['path'])),

	T('alaska_grep_search',
		'Search for a text pattern or regex across the workspace (ripgrep). Returns file:line:content matches grouped by file. Use this BEFORE alaska_read_file when you do not know which file contains a symbol. Read-only, works in Plan/Read-only modes. regex=false (default) treats the pattern as a literal substring.',
		obj({
			pattern: { type: 'string', description: 'Text or regex to search for.' },
			regex: { type: 'boolean', description: 'Treat pattern as PCRE2 regex. Default false.', default: false },
			case_sensitive: { type: 'boolean', description: 'Case-sensitive match. Default true.', default: true },
			include: { type: 'string', description: 'Glob to limit files, e.g. "src/**/*.ts".' },
			exclude: { type: 'string', description: 'Extra glob to exclude.' },
			path: { type: 'string', description: 'Subdirectory to limit the search to. Default whole workspace.' },
			max_results: { type: 'integer', description: 'Max total matches. Default 100, cap 500.', default: 100 },
		}, ['pattern'])),

	T('alaska_list_directory',
		'List entries in a workspace directory as a tree with sizes. Use to understand project structure. Respects standard excludes (node_modules, .git, out, dist, build). Read-only, works in Plan/Read-only modes.',
		obj({
			path: { type: 'string', description: 'Workspace-relative directory. "" or "." = root.' },
			depth: { type: 'integer', description: 'Recursion depth. 0 = this dir only. Max 4. Default 1.', default: 1 },
			include_hidden: { type: 'boolean', description: 'Include dotfiles. Default false.', default: false },
		}, ['path'])),

	T('alaska_write_file',
		'Create a new file or overwrite an existing one. Pass the FULL final contents — never a diff.',
		obj({
			path: { type: 'string', description: 'Workspace-relative path. Forward slashes. No leading slash, no "..".' },
			content: { type: 'string', description: 'Full file contents to write.' },
		}, ['path', 'content'])),

	T('alaska_patch_file',
		'Replace an exact string inside an existing file (find → replace). ALWAYS alaska_read_file first so `find` matches the current bytes exactly. `find` must match exactly one place unless replace_all is true. Do NOT include the line-number prefix from alaska_read_file.',
		obj({
			path: { type: 'string', description: 'Workspace-relative path.' },
			find: { type: 'string', description: 'Exact snippet to find (raw bytes, no line-number prefix).' },
			replace: { type: 'string', description: 'Replacement snippet.' },
			replace_all: { type: 'boolean', description: 'Replace every occurrence. Default false.' },
		}, ['path', 'find', 'replace'])),

	T('alaska_delete_file',
		'Delete a file from the workspace.',
		obj({ path: { type: 'string', description: 'Workspace-relative path.' } }, ['path'])),

	T('alaska_run_command',
		'Run a shell command in the workspace. Returns { ok, exit_code, output_tail, truncated, duration_ms }. Destructive patterns (whole-disk rm, mkfs, dd to block devices, fork bombs, shutdown/reboot, curl|sh pipes) are rejected without running.',
		obj({
			command: { type: 'string', description: 'The full shell command to execute.' },
			cwd: { type: 'string', description: 'Optional workspace-relative working directory.' },
		}, ['command'])),

	T('alaska_web_search',
		'Search the public web for information beyond your training cutoff or the workspace. Returns up to 20 hits with title, URL, snippet. After a useful hit, use alaska_web_fetch to read the page. Read-only, no approval needed.',
		obj({
			query: { type: 'string', description: 'Search query. Be specific; include versions/library names.' },
			max_results: { type: 'integer', description: 'Hits to return. Default 8, cap 20.', default: 8 },
			freshness: { type: 'string', enum: ['', 'pd', 'pw', 'pm', 'py'], description: 'Time filter: empty=any, pd=day, pw=week, pm=month, py=year.' },
			site_filter: { type: 'string', description: 'Restrict to a domain, e.g. "github.com". Empty = unrestricted.' },
		}, ['query'])),

	T('alaska_web_fetch',
		'Fetch and read the contents of a specific URL (HTML stripped to markdown, up to 200 KB). Blocks private/internal hosts (SSRF-safe). Binary files are rejected. Read-only, no approval needed.',
		obj({
			url: { type: 'string', description: 'Full http(s) URL. No file://, no internal hosts.' },
			format: { type: 'string', enum: ['markdown', 'html', 'text'], description: 'Delivery format. Default markdown.', default: 'markdown' },
			max_bytes: { type: 'integer', description: 'Max content bytes. Default 200000, cap 5000000.', default: 200000 },
		}, ['url'])),

	T('alaska_announce_plan',
		'Announce a multi-file plan to the user BEFORE any writes. Call whenever the request touches two or more files. Returns { ok, approved, reason? }. Wait for the result before issuing writes.',
		obj({
			rationale: { type: 'string', description: 'One paragraph explaining the change.' },
			changes: {
				type: 'array', description: 'One entry per file, in execution order.',
				items: obj({
					path: { type: 'string', description: 'Workspace-relative path.' },
					action: { type: 'string', enum: ['create', 'edit', 'delete'], description: 'Intended verb.' },
					summary: { type: 'string', description: 'One line — what changes.' },
				}, ['path', 'action', 'summary']),
			},
		}, ['changes', 'rationale'])),
];

const BY_NAME = new Map(TOOL_DEFINITIONS.map(t => [t.function.name, t]));

// The tools to expose for a given agent/permission mode.
//   agentMode 'chat'          → no tools (plain conversation + memory).
//   permissionMode 'plan'|'readonly' → read-only tools only.
//   otherwise                 → the full set.
export function toolsForMode(agentMode = 'agent', permissionMode = 'auto') {
	if (agentMode === 'chat') { return []; }
	if (permissionMode === 'plan' || permissionMode === 'readonly') {
		return TOOL_DEFINITIONS.filter(t => READ_ONLY_TOOLS.has(t.function.name));
	}
	return TOOL_DEFINITIONS.slice();
}

export function toolByName(name) { return BY_NAME.get(name) || null; }
export function isReadOnlyTool(name) { return READ_ONLY_TOOLS.has(name); }
