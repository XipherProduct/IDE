/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { joinPath, isEqualOrParent, isEqual, dirname as uriDirname } from '../../../../base/common/resources.js';
import { IFileService, IFileStat } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IAlaskaActivityService } from './alaskaActivityService.js';
import { OperatingSystem } from '../../../../base/common/platform.js';
import { IShellLaunchConfig, ITerminalProfile } from '../../../../platform/terminal/common/terminal.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExpression } from '../../../../base/common/glob.js';
import { ISearchService, ITextQuery, QueryType, ISearchComplete, IFileMatch, ITextSearchMatch, resultIsMatch } from '../../../services/search/common/search.js';
import { AlaskaAgentMode } from '../common/alaskaAgentMode.js';
import { IAlaskaAuthService, ALASKA_API_BASE } from './alaskaAuthService.js';
import { abortSignalFrom, buildSignedHeaders, parseAlaskaApiError } from './alaskaApiClient.js';

export interface IAlaskaTool {
	readonly type: 'function';
	readonly function: {
		readonly name: string;
		readonly description: string;
		readonly parameters: object;
	};
}

export interface IAlaskaToolCall {
	readonly id: string;
	readonly name: string;
	readonly argumentsJson: string;
}

export interface IAlaskaToolResult {
	readonly callId: string;
	readonly name: string;
	readonly content: string;
	readonly edit?: IAlaskaToolEdit;
}

export interface IAlaskaToolEdit {
	readonly action: 'create' | 'replace' | 'patch' | 'delete';
	readonly path: string;
	readonly resource: URI;
	readonly content?: string;
	readonly find?: string;
	readonly newSnippet?: string;
}

export const TOOL_DEFINITIONS: readonly IAlaskaTool[] = [
	{
		type: 'function',
		function: {
			name: 'alaska_write_file',
			description:
				'Create a new file or overwrite an existing one. Use this whenever you produce code, prose, or config the user asked you to make. Always pass the FULL final contents — never a diff.',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'Workspace-relative path. Forward slashes. No leading slash, no "..".',
					},
					content: {
						type: 'string',
						description: 'Full file contents to write.',
					},
				},
				required: ['path', 'content'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_patch_file',
			description:
				'Replace an exact string inside an existing file (find → replace). ALWAYS alaska_read_file first so `find` matches the current bytes exactly. `find` must match exactly one place; if it appears more than once, add surrounding lines to make it unique, or set replace_all:true to change EVERY occurrence (handy for renaming an identifier). Do NOT include the line-number prefix shown by alaska_read_file in `find`. For large rewrites, prefer alaska_write_file with the full new content.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'Workspace-relative path of the file to patch.' },
					find: { type: 'string', description: 'Exact snippet to find (raw file bytes, no line-number prefix). Must occur exactly once unless replace_all is true.' },
					replace: { type: 'string', description: 'Replacement snippet.' },
					replace_all: { type: 'boolean', description: 'Replace every occurrence instead of requiring a unique match. Default false. Use for renaming an identifier.' },
				},
				required: ['path', 'find', 'replace'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_delete_file',
			description: 'Delete a file from the workspace.',
			parameters: {
				type: 'object',
				properties: { path: { type: 'string', description: 'Workspace-relative path.' } },
				required: ['path'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_read_file',
			description:
				'Read a workspace file. Output is line-numbered as `<n>\\t<line>` — the number is a REFERENCE only and must NOT be included in an alaska_patch_file `find`. Read BEFORE patching so your find-string matches exact bytes. For large files, pass offset (1-based start line) and limit (line count) to read just a window; the result reports total_lines. At most 64 KiB per call; larger output is truncated and flagged.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'Workspace-relative path.' },
					offset: { type: 'number', description: '1-based line to start reading from. Optional; default 1.' },
					limit: { type: 'number', description: 'Maximum number of lines to read from offset. Optional; default: to end of file.' },
				},
				required: ['path'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_grep_search',
			description:
				'Search for a text pattern or regex across the workspace using ripgrep. Returns file:line:content matches grouped by file. Use this BEFORE alaska_read_file when you do not know which file contains a symbol — it is FAR cheaper than guessing filenames. Respects .gitignore and common excludes (node_modules, .git, out, dist, build, vendor, target, __pycache__). Read-only, no user approval needed and works even in Read-only / Plan permission modes. Returns up to max_results matches; the result reports whether output was truncated. For "find this exact string" use literal mode (regex: false, default). For symbol searches like function\\s+parseArgs|class\\s+Foo use regex: true.',
			parameters: {
				type: 'object',
				properties: {
					pattern: {
						type: 'string',
						description: 'Text or regex pattern to search for. When regex=false, treated as a literal substring.',
					},
					regex: {
						type: 'boolean',
						description: 'Treat pattern as PCRE2 regex via ripgrep. Default false.',
						default: false,
					},
					case_sensitive: {
						type: 'boolean',
						description: 'Case-sensitive match. Default true.',
						default: true,
					},
					include: {
						type: 'string',
						description: 'Glob pattern to limit which files are searched. Examples: "**/*.ts", "src/**/*.{ts,tsx}", "*.go". Default empty (all files except the standard excludes).',
					},
					exclude: {
						type: 'string',
						description: 'Additional glob to exclude beyond the defaults. Example: "**/*.test.ts".',
					},
					path: {
						type: 'string',
						description: 'Workspace-relative subdirectory to limit the search to. Default empty / "." (entire workspace).',
					},
					max_results: {
						type: 'integer',
						description: 'Maximum total matches to return. Default 100, hard cap 500.',
						default: 100,
					},
					max_files: {
						type: 'integer',
						description: 'Maximum distinct files in results. Default 50, hard cap 200.',
						default: 50,
					},
					context_lines: {
						type: 'integer',
						description: 'Number of context lines around each match. Default 0, max 5.',
						default: 0,
					},
				},
				required: ['pattern'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_list_directory',
			description:
				'List entries in a workspace directory as a tree of files and folders with sizes. Use this to understand project structure or before alaska_read_file when you need to know what files exist in a folder. Respects standard excludes (node_modules, .git, out, dist, build, vendor, target, __pycache__). Read-only, no user approval needed and works even in Read-only / Plan permission modes.',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'Workspace-relative directory path. Empty string or "." means workspace root.',
					},
					depth: {
						type: 'integer',
						description: 'Recursion depth. 0 = list this directory only. 1 = include immediate subdirectories. Max 4. Default 1.',
						default: 1,
					},
					include_hidden: {
						type: 'boolean',
						description: 'Include dotfiles (names starting with .). Default false.',
						default: false,
					},
					max_entries: {
						type: 'integer',
						description: 'Cap on total entries returned. Default 200, hard cap 1000.',
						default: 200,
					},
				},
				required: ['path'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_announce_plan',
			description:
				'Announce the multi-file plan to the user BEFORE making any writes. Call this whenever the request would touch two or more files. The IDE renders the plan as an approval card; the user picks Approve / Decline / Edit. Wait for the result before issuing alaska_write_file / alaska_patch_file / alaska_delete_file calls. Returns { ok, approved, reason? } and, when the user edits, the revised plan.',
			parameters: {
				type: 'object',
				properties: {
					rationale: { type: 'string', description: 'One paragraph explaining the change and why it touches these files.' },
					changes: {
						type: 'array',
						description: 'One entry per file the plan will touch, in execution order.',
						items: {
							type: 'object',
							properties: {
								path: { type: 'string', description: 'Workspace-relative path.' },
								action: { type: 'string', enum: ['create', 'edit', 'delete'], description: 'Intended verb.' },
								summary: { type: 'string', description: 'One line — what changes inside that file.' },
							},
							required: ['path', 'action', 'summary'],
							additionalProperties: false,
						},
					},
				},
				required: ['changes', 'rationale'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_web_search',
			description:
				'Search the public web for information beyond your training cutoff or beyond the workspace. Use this when the user asks about: current versions of libraries, recent changelogs, recent github issues/PRs, API references for unfamiliar libraries, current best practices, news, or anything that may have changed since your training. Returns up to 20 hits with title, URL, and snippet. After a useful hit, use alaska_web_fetch on its URL to read the full page. Do NOT use for questions about the local workspace — use alaska_grep_search / alaska_read_file instead. Read-only, no user approval needed. Cached for 24 hours.',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Search query. Be specific. Include version numbers, language names, library names when relevant. Example: "VS Code 1.119 InlineCompletionsProvider API".',
					},
					max_results: {
						type: 'integer',
						description: 'How many hits to return. Default 8, hard cap 20.',
						default: 8,
					},
					freshness: {
						type: 'string',
						enum: ['', 'pd', 'pw', 'pm', 'py'],
						description: 'Time filter: empty=any, pd=past day, pw=past week, pm=past month, py=past year.',
					},
					site_filter: {
						type: 'string',
						description: 'Restrict to a domain. Example: "github.com" or "developer.mozilla.org". Empty = unrestricted.',
					},
					provider: {
						type: 'string',
						enum: ['', 'brave', 'tavily', 'duckduckgo'],
						description: 'Preferred provider. Empty = backend default (brave). Backend falls back to other providers automatically on failure.',
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_web_fetch',
			description:
				'Fetch and read the contents of a specific URL. Use this AFTER alaska_web_search returns a useful hit, or when the user pastes a URL and you need its content. Backend strips HTML to readable markdown, returns up to 200 KB by default. Blocks private/internal hosts (SSRF-safe). Supports HTML, JSON, Markdown, plain text. Binary files (PDF, images, video) are rejected. Cached for 1 hour. Read-only, no user approval needed.',
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'Full http(s) URL. No file://, no internal hosts.',
					},
					format: {
						type: 'string',
						enum: ['markdown', 'html', 'text'],
						description: 'How to deliver HTML pages. "markdown" (default) is best for LLM reading. "html" returns sanitized HTML. "text" returns plain text.',
						default: 'markdown',
					},
					max_bytes: {
						type: 'integer',
						description: 'Max content bytes to return. Default 200000 (200 KB), hard cap 5000000 (5 MB). Smaller = faster + cheaper.',
						default: 200000,
					},
				},
				required: ['url'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_open_browser',
			description:
				'Open a URL in the IDE\'s built-in browser panel (Simple Browser) so the user sees the live page side-by-side with their code — like Cursor\'s in-editor browser. Use this when the user wants to VIEW a page live (a running dev server, docs, a preview, a design), or asks you to "open" / "show" a site. This is a live rendered browser, not text extraction — to READ page content into your context use alaska_web_fetch instead. You can open localhost dev servers (e.g. http://localhost:3000) here even though alaska_web_fetch blocks them, because this renders in the user\'s own browser view, not the backend. Read-only from your side, no user approval needed.',
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'Full http(s) URL to open, e.g. "http://localhost:5173" or "https://react.dev/reference/react". Must include the scheme.',
					},
				},
				required: ['url'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_dispatch_subagent',
			description:
				'Spawn a focused, read-only sub-agent to investigate part of the codebase in parallel with other sub-agents. The sub-agent has its own context window, runs with read-only tools only (alaska_read_file, alaska_grep_search, alaska_list_directory, alaska_web_search, alaska_web_fetch), and returns a SUMMARIZED result (not raw tool outputs). Use when you need to inspect multiple distinct areas in one turn (e.g., "check 5 files for security issues"). 2-5 sub-agents per turn maximum. NEVER spawn a sub-agent for a single-file task — call the read tools directly instead. Sub-agents cannot spawn further sub-agents.',
			parameters: {
				type: 'object',
				properties: {
					task: {
						type: 'string',
						description: 'A focused, specific task description. Examples: "Find all places where authToken is logged", "Check src/auth/* for SQL injection patterns".',
					},
					expected_output: {
						type: 'string',
						description: 'What format the sub-agent should return (file list, code snippets, short summary, etc.).',
					},
					parallel_group: {
						type: 'string',
						description: 'Optional group id — sub-agents with the same parallel_group within one turn are launched concurrently and joined together.',
					},
				},
				required: ['task', 'expected_output'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_run_command',
			description:
				'Run a shell command in a visible workspace terminal. The IDE opens (or reuses) a terminal tab in the bottom panel, streams output to both the user and you, and shows an Abort button in the chat. Long-running commands are supported (hard cap 30 minutes). Returns { ok, exit_code, output_tail (last 8 KiB), full_size, truncated, duration_ms, encoding, shell }. The first invocation in a workspace asks the user; the user can promote trust to auto-approve safe commands or all commands. Destructive patterns (whole-disk rm, mkfs, dd to block devices, fork bombs, shutdown/reboot, curl|sh pipes) are rejected without running.',
			parameters: {
				type: 'object',
				properties: {
					command: { type: 'string', description: 'The full shell command to execute. Runs in the user\'s default shell (PowerShell on Windows, the user\'s $SHELL on macOS/Linux).' },
					cwd: { type: 'string', description: 'Optional workspace-relative working directory. Defaults to the workspace root.' },
				},
				required: ['command'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_start',
			description:
				'Start a PERSISTENT, named interactive terminal session that stays alive across turns. Use this — not alaska_run_command — when you need to drive a live process: a REPL (python, node), a dev server, a database shell, or any command that prompts for input. The session opens a visible terminal tab and keeps running until you call alaska_terminal_stop or the process exits. Send input with alaska_terminal_send, read output with alaska_terminal_read, and block on a condition with alaska_terminal_wait. Returns { ok, name, shell, status }. The first start in a workspace asks the user for consent, same as alaska_run_command.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Unique session name (e.g. "devserver", "pyrepl"). Reused by the other alaska_terminal_* tools to target this session.' },
					command: { type: 'string', description: 'Optional command submitted once the shell is ready (e.g. "python3", "npm run dev"). Omit to get a bare interactive shell.' },
					cwd: { type: 'string', description: 'Optional workspace-relative working directory. Defaults to the workspace root.' },
					force: { type: 'boolean', description: 'If a session with this name already exists, stop it first and start fresh. Default false (errors instead).' },
				},
				required: ['name'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_send',
			description:
				'Send input to a running persistent terminal session started with alaska_terminal_start. By default the input is submitted as a line (Enter appended). Set execute:false to type without submitting (e.g. partial input, or a raw control sequence). Returns { ok }. To read what happened, follow with alaska_terminal_read or alaska_terminal_wait.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The session name passed to alaska_terminal_start.' },
					input: { type: 'string', description: 'Text to send to the session\'s stdin.' },
					execute: { type: 'boolean', description: 'Append Enter to submit the line. Default true.' },
				},
				required: ['name', 'input'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_read',
			description:
				'Read the current output buffer (ANSI stripped, last ~256 KiB) of a persistent terminal session. Returns { ok, output, status ("running"|"exited"), exit_code, truncated }. Use after alaska_terminal_send to see the result, or any time you need the session\'s latest screen.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The session name passed to alaska_terminal_start.' },
				},
				required: ['name'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_wait',
			description:
				'Block until a persistent terminal session reaches a condition, then return its output. Event-driven (no polling), capped at 120 seconds. Give exactly one of: text (wait until this substring appears), regex (wait until this pattern matches), gone (wait until this substring is absent), stable_ms (wait until output is quiet for this many ms — good for "the command finished printing"). Returns { ok, matched, reason ("matched"|"timeout"|"exited"), output }. Resolves early if the process exits.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The session name passed to alaska_terminal_start.' },
					text: { type: 'string', description: 'Wait until this substring appears in the output.' },
					regex: { type: 'string', description: 'Wait until this JS regex matches the output.' },
					gone: { type: 'string', description: 'Wait until this substring is no longer present.' },
					stable_ms: { type: 'number', description: 'Wait until output has been unchanged for this many milliseconds.' },
					timeout_ms: { type: 'number', description: 'Max wait in ms (default 10000, hard-capped at 120000).' },
				},
				required: ['name'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_stop',
			description: 'Stop and dispose a persistent terminal session started with alaska_terminal_start. Kills the process and closes its tab. Returns { ok }. No-op if the session is already gone. Always stop sessions you no longer need.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The session name passed to alaska_terminal_start.' },
				},
				required: ['name'],
				additionalProperties: false,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'alaska_terminal_list',
			description: 'List the persistent terminal sessions currently open in this chat. Returns { ok, sessions: [{ name, command, status, exit_code, shell }] }. Use to recover session names or check what is still running.',
			parameters: {
				type: 'object',
				properties: {},
				additionalProperties: false,
			},
		},
	},
];

export const RUN_COMMAND_TRUST_KEY = 'alaska.runCommand.trust';

export type RunCommandTrustLevel = 'ask' | 'auto-safe';

export const ALASKA_PERMISSION_MODE_KEY = 'alaska.permissionMode';

export type AlaskaPermissionMode = 'ask' | 'auto' | 'readonly' | 'plan';

export const ALASKA_PERMISSION_MODES: readonly AlaskaPermissionMode[] = ['ask', 'auto', 'readonly', 'plan'];

export interface IAlaskaPermissionState {
	readonly mode: AlaskaPermissionMode;
}

export function isMutatingToolName(name: string): boolean {
	return name === 'alaska_write_file'
		|| name === 'alaska_patch_file'
		|| name === 'alaska_delete_file'
		|| name === 'alaska_run_command';
}

export function isWriteOrRunTool(name: string): boolean {
	return isMutatingToolName(name);
}

export function isReadOnlyToolName(name: string): boolean {
	return name === 'alaska_read_file'
		|| name === 'alaska_grep_search'
		|| name === 'alaska_list_directory'
		|| name === 'alaska_web_search'
		|| name === 'alaska_web_fetch'
		|| name === 'alaska_open_browser';
}

export interface IRunCommandDenial {
	readonly reason: string;
}

const RUN_COMMAND_DENY_RULES: ReadonlyArray<{ readonly pattern: RegExp; readonly reason: string }> = [
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

const RUN_COMMAND_READ_ONLY_HEADS: ReadonlySet<string> = new Set([
	'ls', 'dir', 'pwd', 'whoami', 'uname', 'hostname', 'echo',
	'cat', 'head', 'tail', 'less', 'more',
	'grep', 'rg', 'fd', 'tr', 'cut', 'wc', 'sort', 'uniq', 'comm',
	'which', 'where', 'stat', 'file', 'ps', 'df', 'du',
	'git',
	'npm', 'pnpm', 'yarn', 'bun',
	'cargo', 'go',
	'Get-ChildItem', 'Get-Content', 'Get-Location', 'Get-Item',
	'Select-String', 'Get-Date', 'Test-Path',
]);

const RUN_COMMAND_READ_ONLY_GIT: ReadonlySet<string> = new Set([
	'status', 'log', 'diff', 'show', 'branch', 'remote', 'rev-parse', 'describe', 'tag', 'blame', 'ls-files', 'ls-tree', 'shortlog', 'reflog',
]);

const RUN_COMMAND_READ_ONLY_NODE_MGR: ReadonlySet<string> = new Set([
	'list', 'ls', 'view', 'info', 'outdated', 'doctor',
]);

const RUN_COMMAND_READ_ONLY_CARGO_GO: ReadonlySet<string> = new Set([
	'tree', 'metadata', 'version', 'help',
	'list', 'vet',
]);

const ANSI_PATTERN = /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\)|[@-Z\\-_])/g;

const MAX_READ_BYTES = 64 * 1024;

export function evaluateRunCommandDenial(command: string): IRunCommandDenial | undefined {
	const c = command.trim();
	if (!c) {
		return { reason: 'empty command' };
	}
	for (const rule of RUN_COMMAND_DENY_RULES) {
		if (rule.pattern.test(c)) {
			return { reason: rule.reason };
		}
	}
	return undefined;
}

const SHELL_CHAIN_OPERATORS = /(?:;|&&|\|\||\||>|<|`|\$\()/;

export function isReadOnlyRunCommand(command: string): boolean {
	if (SHELL_CHAIN_OPERATORS.test(command)) {
		return false;
	}
	const head = extractCommandHead(command);
	if (!head) {
		return false;
	}
	if (head === 'git') {
		const sub = extractSubcommand(command, 1);
		if (sub === 'branch') {
			const flags = extractFlags(command);
			if (flags.size > 0 && !flags.has('--show-current') && !flags.has('-v') && !flags.has('-a') && !flags.has('-r') && !flags.has('--list') && !flags.has('--all')) {
				return false;
			}
		}
		return !!sub && RUN_COMMAND_READ_ONLY_GIT.has(sub);
	}
	if (head === 'npm' || head === 'pnpm' || head === 'yarn' || head === 'bun') {
		const sub = extractSubcommand(command, 1);
		if (head === 'npm' && sub === 'run') {
			return true;
		}
		return !!sub && RUN_COMMAND_READ_ONLY_NODE_MGR.has(sub);
	}
	if (head === 'cargo' || head === 'go') {
		const sub = extractSubcommand(command, 1);
		return !!sub && RUN_COMMAND_READ_ONLY_CARGO_GO.has(sub);
	}
	if (head === 'sed') {
		if (/\s-i\b/.test(command)) {
			return false;
		}
		return true;
	}
	return RUN_COMMAND_READ_ONLY_HEADS.has(head);
}

export interface IRunCommandShellPlan {
	readonly config: IShellLaunchConfig;
	readonly shellLabel: string;
	readonly displayShellName: string;
}

export interface IRunCommandShellInputs {
	readonly command: string;
	readonly cwd: URI;
	readonly os: OperatingSystem;
	readonly isRemote: boolean;
	readonly profile?: ITerminalProfile;
	readonly userShellEnv?: string;
	readonly terminalName: string;
}

export function buildRunCommandShellPlan(inputs: IRunCommandShellInputs): IRunCommandShellPlan {
	const { command, cwd, os, isRemote, profile, userShellEnv, terminalName } = inputs;
	const winBaseEnv: Record<string, string> = {
		PYTHONIOENCODING: 'utf-8',
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
	};
	const unixBaseEnv: Record<string, string> = {
		PYTHONIOENCODING: 'utf-8',
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
		LANG: 'C.UTF-8',
		LC_ALL: 'C.UTF-8',
	};
	if (os === OperatingSystem.Windows && !isRemote) {
		const winShell = pickWindowsShell(profile);
		if (winShell.kind === 'wsl') {
			const profileArgs = Array.isArray(winShell.profileArgs) ? winShell.profileArgs : [];
			return {
				config: {
					name: terminalName,
					executable: winShell.executable,
					args: [...profileArgs, '--', 'bash', '-lc', command],
					cwd,
					env: unixBaseEnv,
					waitOnExit: RUN_WAIT_ON_EXIT,
					isFeatureTerminal: true,
				},
				shellLabel: 'wsl',
				displayShellName: winShell.distroLabel ? `WSL · ${winShell.distroLabel}` : 'WSL',
			};
		}
		if (winShell.kind === 'pwsh' || winShell.kind === 'powershell') {
			const prefix = 'chcp 65001 > $null ; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new() ; [Console]::InputEncoding = [System.Text.UTF8Encoding]::new() ; $OutputEncoding = [System.Text.UTF8Encoding]::new()';
			const script = `${prefix} ; ${command}`;
			return {
				config: {
					name: terminalName,
					executable: winShell.executable,
					args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
					cwd,
					env: winBaseEnv,
					waitOnExit: RUN_WAIT_ON_EXIT,
					isFeatureTerminal: true,
				},
				shellLabel: winShell.kind,
				displayShellName: winShell.kind === 'pwsh' ? 'PowerShell 7' : 'Windows PowerShell',
			};
		}
		const cmdScript = `chcp 65001 > nul && ${command}`;
		return {
			config: {
				name: terminalName,
				executable: winShell.executable,
				args: ['/d', '/c', cmdScript],
				cwd,
				env: winBaseEnv,
				waitOnExit: RUN_WAIT_ON_EXIT,
				isFeatureTerminal: true,
			},
			shellLabel: 'cmd',
			displayShellName: 'Command Prompt',
		};
	}
	const unixShell = pickUnixShell(os, isRemote ? undefined : profile, isRemote ? undefined : userShellEnv);
	return {
		config: {
			name: terminalName,
			executable: unixShell.executable,
			args: ['-c', command],
			cwd,
			env: unixBaseEnv,
			waitOnExit: RUN_WAIT_ON_EXIT,
			useShellEnvironment: !isRemote,
			isFeatureTerminal: true,
		},
		shellLabel: unixShell.kind,
		displayShellName: unixShell.label,
	};
}

const RUN_WAIT_ON_EXIT = (exitCode: number) => `\r\n[Xipher IDE] Command finished with exit code ${exitCode}. The terminal is kept open so you can scroll back; close this tab when you're done.\r\n`;

/**
 * Build a launch config for a *persistent interactive* shell — no baked `-c
 * command`, so the agent can send input over the session's lifetime (grok
 * ptyctl model, see [[grok-ptyctl-plan]]). Reuses the same shell-pick and
 * UTF-8 env as {@link buildRunCommandShellPlan}; the initial command, if any,
 * is sent as input after launch rather than passed as an argument.
 */
export function buildInteractiveShellPlan(inputs: Omit<IRunCommandShellInputs, 'command'>): IRunCommandShellPlan {
	const { cwd, os, isRemote, profile, userShellEnv, terminalName } = inputs;
	const winBaseEnv: Record<string, string> = {
		PYTHONIOENCODING: 'utf-8',
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
	};
	const unixBaseEnv: Record<string, string> = {
		PYTHONIOENCODING: 'utf-8',
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
		LANG: 'C.UTF-8',
		LC_ALL: 'C.UTF-8',
	};
	if (os === OperatingSystem.Windows && !isRemote) {
		const winShell = pickWindowsShell(profile);
		if (winShell.kind === 'wsl') {
			const profileArgs = Array.isArray(winShell.profileArgs) ? winShell.profileArgs : [];
			return {
				config: { name: terminalName, executable: winShell.executable, args: [...profileArgs], cwd, env: unixBaseEnv, isFeatureTerminal: true },
				shellLabel: 'wsl',
				displayShellName: winShell.distroLabel ? `WSL · ${winShell.distroLabel}` : 'WSL',
			};
		}
		if (winShell.kind === 'pwsh' || winShell.kind === 'powershell') {
			return {
				config: { name: terminalName, executable: winShell.executable, args: ['-NoLogo', '-NoProfile'], cwd, env: winBaseEnv, isFeatureTerminal: true },
				shellLabel: winShell.kind,
				displayShellName: winShell.kind === 'pwsh' ? 'PowerShell 7' : 'Windows PowerShell',
			};
		}
		return {
			config: { name: terminalName, executable: winShell.executable, args: [], cwd, env: winBaseEnv, isFeatureTerminal: true },
			shellLabel: 'cmd',
			displayShellName: 'Command Prompt',
		};
	}
	const unixShell = pickUnixShell(os, isRemote ? undefined : profile, isRemote ? undefined : userShellEnv);
	return {
		config: { name: terminalName, executable: unixShell.executable, args: ['-i'], cwd, env: unixBaseEnv, useShellEnvironment: !isRemote, isFeatureTerminal: true },
		shellLabel: unixShell.kind,
		displayShellName: unixShell.label,
	};
}

interface IWindowsShellPick {
	readonly kind: 'pwsh' | 'powershell' | 'cmd' | 'wsl';
	readonly executable: string;
	readonly profileArgs?: ReadonlyArray<string>;
	readonly distroLabel?: string;
}

function pickWindowsShell(profile: ITerminalProfile | undefined): IWindowsShellPick {
	if (profile?.path) {
		const lower = profile.path.toLowerCase();
		const args = Array.isArray(profile.args) ? profile.args.filter((a): a is string => typeof a === 'string') : [];
		if (lower.endsWith('\\wsl.exe') || lower === 'wsl.exe' || lower.endsWith('/wsl.exe')) {
			const distroIdx = args.findIndex(a => a === '-d' || a === '--distribution');
			const distroLabel = distroIdx >= 0 && args[distroIdx + 1] ? args[distroIdx + 1] : undefined;
			return { kind: 'wsl', executable: profile.path, profileArgs: args, distroLabel };
		}
		if (lower.endsWith('\\pwsh.exe') || lower === 'pwsh.exe' || lower.endsWith('/pwsh.exe')) {
			return { kind: 'pwsh', executable: profile.path };
		}
		if (lower.endsWith('\\powershell.exe') || lower === 'powershell.exe' || lower.endsWith('/powershell.exe')) {
			return { kind: 'powershell', executable: profile.path };
		}
		if (lower.endsWith('\\cmd.exe') || lower === 'cmd.exe' || lower.endsWith('/cmd.exe')) {
			return { kind: 'cmd', executable: profile.path };
		}
	}
	return { kind: 'powershell', executable: 'powershell.exe' };
}

interface IUnixShellPick {
	readonly kind: 'bash' | 'zsh' | 'sh' | 'fish';
	readonly executable: string;
	readonly label: string;
}

function pickUnixShell(os: OperatingSystem, profile: ITerminalProfile | undefined, userShellEnv: string | undefined): IUnixShellPick {
	const candidates: string[] = [];
	if (profile?.path) {
		candidates.push(profile.path);
	}
	if (userShellEnv && userShellEnv.length > 0) {
		candidates.push(userShellEnv);
	}
	if (os === OperatingSystem.Macintosh) {
		candidates.push('/bin/zsh', '/bin/bash', '/bin/sh');
	} else {
		candidates.push('/bin/bash', '/bin/zsh', '/bin/sh');
	}
	for (const cand of candidates) {
		const base = cand.split('/').pop() ?? cand;
		if (base === 'bash') { return { kind: 'bash', executable: cand, label: 'bash' }; }
		if (base === 'zsh') { return { kind: 'zsh', executable: cand, label: 'zsh' }; }
		if (base === 'fish') { return { kind: 'fish', executable: cand, label: 'fish' }; }
		if (base === 'sh') { return { kind: 'sh', executable: cand, label: 'sh' }; }
	}
	return { kind: 'sh', executable: '/bin/sh', label: 'sh' };
}

export function detectMojibake(text: string, sampleLength: number = 1024): boolean {
	if (!text) {
		return false;
	}
	const sample = text.length > sampleLength ? text.slice(0, sampleLength) : text;
	let fffdCount = 0;
	for (let i = 0; i < sample.length; i++) {
		if (sample.charCodeAt(i) === 0xFFFD) {
			fffdCount++;
		}
	}
	return fffdCount * 100 > sample.length * 5;
}

export function stripAnsi(input: string): string {
	if (!input) {
		return '';
	}
	return input.replace(ANSI_PATTERN, '').replace(/\r(?!\n)/g, '\n');
}

function extractCommandHead(command: string): string | undefined {
	const trimmed = command.trim();
	if (!trimmed) { return undefined; }
	const unwrapped = unwrapShellWrapper(trimmed);
	const m = unwrapped.match(/^([A-Za-z][\w.\-]*)/);
	return m ? m[1] : undefined;
}

function extractSubcommand(command: string, index: number): string | undefined {
	const unwrapped = unwrapShellWrapper(command.trim());
	const tokens = unwrapped.split(/\s+/).filter(t => t.length > 0 && !t.startsWith('-'));
	return tokens[index];
}

function extractFlags(command: string): Set<string> {
	const out = new Set<string>();
	const unwrapped = unwrapShellWrapper(command.trim());
	for (const tok of unwrapped.split(/\s+/)) {
		if (tok.startsWith('-')) {
			out.add(tok.split('=')[0]);
		}
	}
	return out;
}

function unwrapShellWrapper(command: string): string {
	const m = command.match(/^(?:pwsh|powershell|cmd|bash|zsh|sh|fish)(?:\.exe)?\s+(?:-[a-zA-Z]+\s+)*(?:-(?:c|Command|lc)\s+)?(?:"([^"]+)"|'([^']+)'|(.+))$/i);
	if (m) {
		return (m[1] ?? m[2] ?? m[3] ?? '').trim();
	}
	return command;
}

export class AlaskaToolExecutor {

	private permissionMode: AlaskaPermissionMode = 'ask';
	private agentMode: AlaskaAgentMode = 'chat';
	private readonly planBuffer: Array<{ tool: string; args: unknown }> = [];

	constructor(
		private readonly fileService: IFileService,
		private readonly textFileService: ITextFileService,
		private readonly workspaceRoot: URI,
		private readonly workspaceTrust?: IWorkspaceTrustManagementService,
		private readonly activityService?: IAlaskaActivityService,
		private readonly logService?: ILogService,
		private readonly searchService?: ISearchService,
		private readonly authService?: IAlaskaAuthService,
	) { }

	setPermissionMode(mode: AlaskaPermissionMode): void {
		this.permissionMode = mode;
		if (mode !== 'plan') {
			this.planBuffer.length = 0;
		}
	}

	getPermissionMode(): AlaskaPermissionMode {
		return this.permissionMode;
	}

	setAgentMode(mode: AlaskaAgentMode): void {
		this.agentMode = mode;
	}

	getAgentMode(): AlaskaAgentMode {
		return this.agentMode;
	}

	drainPlanBuffer(): Array<{ tool: string; args: unknown }> {
		const out = this.planBuffer.slice();
		this.planBuffer.length = 0;
		return out;
	}

	async execute(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		try {
			const isMutating = isMutatingToolName(call.name);
			if (this.agentMode === 'plan' && isWriteOrRunTool(call.name)) {
				return this.softFail(
					call,
					`Tool '${call.name}' is disabled in Plan mode. Use alaska_read_file, alaska_grep_search, or alaska_list_directory to explore the codebase. When you have enough context, end your final message with a numbered tasklist (do not call any more tools). The user will review and click "Approve plan" to switch to Act mode where write tools become available.`,
					'plan_mode_blocked',
				);
			}
			if (isMutating && this.permissionMode === 'readonly') {
				// allow-any-unicode-next-line
				return this.fail(call, 'permission_readonly: this workspace is in Read-only mode; file & shell mutations are blocked. Switch to Ask/Auto in the composer 🔒 menu to enable changes.');
			}
			if (isMutating && this.permissionMode === 'plan') {
				const parsed = this.tryParseArgs(call);
				this.planBuffer.push({ tool: call.name, args: parsed });
				return {
					callId: call.id,
					name: call.name,
					content: JSON.stringify({ planned: true, tool: call.name, args: parsed }),
				};
			}
			if (isMutating && this.workspaceTrust && !this.workspaceTrust.isWorkspaceTrusted()) {
				return this.fail(call, 'workspace_untrusted: file mutations are blocked until you mark this workspace as trusted in VS Code (File → Manage Workspace Trust).');
			}
			switch (call.name) {
				case 'alaska_write_file': return await this.writeFile(call);
				case 'alaska_patch_file': return await this.patchFile(call);
				case 'alaska_delete_file': return await this.deleteFile(call);
				case 'alaska_read_file': return await this.readFile(call);
				case 'alaska_grep_search': return await this.grepSearch(call);
				case 'alaska_list_directory': return await this.listDirectory(call);
				case 'alaska_web_search': return await this.webSearch(call);
				case 'alaska_web_fetch': return await this.webFetch(call);
				case 'alaska_run_command': return this.fail(call, 'alaska_run_command must be routed through the chat view pane');
				default: return this.fail(call, `unknown tool: ${call.name}`);
			}
		} catch (err) {
			if (isAlaskaToolParseError(err)) {
				return {
					callId: call.id,
					name: call.name,
					content: JSON.stringify({
						ok: false,
						error: err.message,
						error_code: 'tool_parse_error',
						tool: err.toolName,
					}),
				};
			}
			if (isAlaskaToolSoftError(err)) {
				return this.softFail(call, err.message, err.code);
			}
			return this.fail(call, err instanceof Error ? err.message : String(err));
		}
	}

	private async writeFile(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{ path?: unknown; content?: unknown; _content_truncated?: unknown }>(call);
		const path = ensureString(args.path, 'path');
		const content = ensureString(args.content, 'content');
		if (args._content_truncated === true) {
			throw new AlaskaToolParseError(call.name, call.argumentsJson, 'content payload was cut off mid-stream before the closing quote');
		}
		const resource = this.resolveSafe(path);
		await this.assertNoSymlinkInPath(resource);
		const existed = await this.fileService.exists(resource);
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({
				ok: true,
				action: existed ? 'replace' : 'create',
				path,
				bytes: bytesOf(content),
			}),
			edit: {
				action: existed ? 'replace' : 'create',
				path,
				resource,
				content,
			},
		};
	}

	private async patchFile(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{ path?: unknown; find?: unknown; replace?: unknown; replace_all?: unknown }>(call);
		const path = ensureString(args.path, 'path');
		const find = ensureString(args.find, 'find');
		const replace = ensureString(args.replace, 'replace');
		const replaceAll = args.replace_all === true;
		if (find.length === 0) {
			return this.fail(call, '`find` must not be empty');
		}
		const resource = this.resolveSafe(path);
		await this.assertNoSymlinkInPath(resource);
		if (!(await this.fileService.exists(resource))) {
			const hint = await this.suggestSimilarFile(path);
			return this.softFail(call, hint ? `file not found: ${path} — did you mean: ${hint}?` : `file not found: ${path}`, 'file_missing');
		}
		const current = (await this.textFileService.read(resource)).value;
		const first = current.indexOf(find);
		if (first < 0) {
			return this.softFail(call, 'find-string not present in file — read it first (alaska_read_file) and match exact bytes including whitespace; do NOT include the line-number prefix', 'find_missed');
		}
		let next: string;
		let replaced: number;
		if (replaceAll) {
			// change every occurrence (handy for renaming an identifier)
			replaced = current.split(find).length - 1;
			next = current.split(find).join(replace);
		} else {
			const second = current.indexOf(find, first + find.length);
			if (second >= 0) {
				return this.fail(call, 'find-string is ambiguous (appears more than once) — add surrounding lines to make it unique, set replace_all:true to change every occurrence, or use alaska_write_file with the full new content');
			}
			next = current.slice(0, first) + replace + current.slice(first + find.length);
			replaced = 1;
		}
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({ ok: true, action: 'patch', path, bytes: bytesOf(next), replaced }),
			edit: { action: 'patch', path, resource, content: next, find, newSnippet: replace },
		};
	}

	private async deleteFile(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{ path?: unknown }>(call);
		const path = ensureString(args.path, 'path');
		const resource = this.resolveSafe(path);
		await this.assertNoSymlinkInPath(resource);
		if (!(await this.fileService.exists(resource))) {
			const hint = await this.suggestSimilarFile(path);
			return this.softFail(call, hint ? `file not found: ${path} — did you mean: ${hint}?` : `file not found: ${path}`, 'file_missing');
		}
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({ ok: true, action: 'delete', path }),
			edit: { action: 'delete', path, resource },
		};
	}

	private async readFile(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{ path?: unknown; offset?: unknown; limit?: unknown }>(call);
		const path = ensureString(args.path, 'path');
		const offset = toPosInt(args.offset); // 1-based first line, optional
		const limit = toPosInt(args.limit);   // max lines, optional
		const resource = this.resolveSafe(path);
		await this.assertNoSymlinkInPath(resource);
		if (!(await this.fileService.exists(resource))) {
			const hint = await this.suggestSimilarFile(path);
			return this.softFail(call, hint ? `file not found: ${path} — did you mean: ${hint}?` : `file not found: ${path}`, 'file_missing');
		}
		const readMarker = this.activityService?.markReading(resource);
		try {
			const raw = (await this.textFileService.read(resource)).value;
			const allLines = raw.split('\n');
			const total = allLines.length;
			const start = offset && offset > 0 ? Math.min(offset, total) : 1;
			const end = limit && limit > 0 ? Math.min(total, start - 1 + limit) : total;
			const selected = allLines.slice(start - 1, end);
			// prefix each line with its 1-based number (TAB-separated). The number
			// is a REFERENCE only — it is NOT part of the file and must be stripped
			// before using the text as an alaska_patch_file `find` argument.
			let numbered = selected.map((l, i) => `${start + i}\t${l}`).join('\n');
			const truncated = numbered.length > MAX_READ_BYTES;
			if (truncated) { numbered = numbered.slice(0, MAX_READ_BYTES); }
			return {
				callId: call.id,
				name: call.name,
				content: JSON.stringify({
					ok: true,
					path,
					total_lines: total,
					start_line: start,
					end_line: end,
					bytes: bytesOf(raw),
					truncated,
					content: numbered,
				}),
			};
		} finally {
			readMarker?.dispose();
		}
	}

	private async grepSearch(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		if (!this.searchService) {
			return this.fail(call, 'search service is not available — workspace search infrastructure missing');
		}
		const args = this.parseArgs<{
			pattern?: unknown;
			regex?: unknown;
			case_sensitive?: unknown;
			include?: unknown;
			exclude?: unknown;
			path?: unknown;
			max_results?: unknown;
			max_files?: unknown;
			context_lines?: unknown;
		}>(call);

		if (typeof args.pattern !== 'string' || args.pattern.length === 0) {
			return this.softFail(call, '`pattern` must be a non-empty string', 'invalid_arguments');
		}
		if (args.pattern.length > 2000) {
			return this.softFail(call, '`pattern` too long (max 2000 chars)', 'invalid_arguments');
		}

		const regex = args.regex === true;
		const caseSensitive = args.case_sensitive !== false;
		const include = typeof args.include === 'string' ? args.include.trim() : '';
		const exclude = typeof args.exclude === 'string' ? args.exclude.trim() : '';
		const subPath = typeof args.path === 'string' ? args.path.trim() : '';
		const maxResults = clampInt(args.max_results, 100, 1, 500);
		const maxFiles = clampInt(args.max_files, 50, 1, 200);
		const contextLines = clampInt(args.context_lines, 0, 0, 5);

		if (regex) {
			try { new RegExp(args.pattern); }
			catch (err) {
				return this.softFail(call, `invalid regex: ${err instanceof Error ? err.message : String(err)}`, 'invalid_regex');
			}
		}

		let folder = this.workspaceRoot;
		if (subPath && subPath !== '.') {
			try { folder = this.resolveSafe(subPath); }
			catch (err) {
				return this.softFail(call, err instanceof Error ? err.message : String(err), 'path_invalid');
			}
			if (!(await this.fileService.exists(folder))) {
				return this.softFail(call, `directory not found: ${subPath}`, 'path_missing');
			}
			const stat = await this.fileService.resolve(folder);
			if (!stat.isDirectory) {
				return this.softFail(call, `not a directory: ${subPath}`, 'path_not_dir');
			}
		}

		const excludeExpression: IExpression = { ...DEFAULT_EXCLUDE_GLOBS };
		if (exclude) {
			excludeExpression[exclude] = true;
		}
		const includeExpression: IExpression | undefined = include ? { [include]: true } : undefined;

		const query: ITextQuery = {
			type: QueryType.Text,
			folderQueries: [{
				folder,
				excludePattern: [{ pattern: excludeExpression }],
				includePattern: includeExpression,
				disregardIgnoreFiles: false,
				disregardGlobalIgnoreFiles: false,
			}],
			contentPattern: {
				pattern: args.pattern,
				isRegExp: regex,
				isCaseSensitive: caseSensitive,
				isWordMatch: false,
				isMultiline: regex && args.pattern.includes('\\n'),
			},
			maxResults,
			maxFileSize: 1024 * 1024,
			surroundingContext: contextLines,
			usePCRE2: regex,
			previewOptions: { matchLines: 1, charsPerLine: 250 },
		};

		let textResult: ISearchComplete;
		try {
			textResult = await this.searchService.textSearch(query, CancellationToken.None);
		} catch (err) {
			return this.softFail(call, `search failed: ${err instanceof Error ? err.message : String(err)}`, 'search_failed');
		}

		const limitedFiles: IFileMatch[] = [];
		for (const fm of textResult.results) {
			if (!fm.results || fm.results.length === 0) {
				continue;
			}
			limitedFiles.push(fm);
			if (limitedFiles.length >= maxFiles) { break; }
		}

		const rendered = renderGrepResults(limitedFiles, args.pattern, regex, maxResults, (uri) => this.relPath(uri));

		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({
				ok: true,
				pattern: args.pattern,
				regex,
				case_sensitive: caseSensitive,
				file_count: limitedFiles.length,
				match_count: rendered.totalMatches,
				truncated: rendered.truncated || textResult.limitHit === true,
				output: rendered.text,
			}),
		};
	}

	private async listDirectory(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{
			path?: unknown;
			depth?: unknown;
			include_hidden?: unknown;
			max_entries?: unknown;
		}>(call);

		if (typeof args.path !== 'string') {
			return this.softFail(call, '`path` must be a string', 'invalid_arguments');
		}
		const rel = args.path.trim();
		const depth = clampInt(args.depth, 1, 0, 4);
		const includeHidden = args.include_hidden === true;
		const maxEntries = clampInt(args.max_entries, 200, 1, 1000);

		let folder: URI;
		try {
			folder = (rel === '' || rel === '.') ? this.workspaceRoot : this.resolveSafe(rel);
		} catch (err) {
			return this.softFail(call, err instanceof Error ? err.message : String(err), 'path_invalid');
		}

		if (!(await this.fileService.exists(folder))) {
			return this.softFail(call, `directory not found: ${rel || '.'}`, 'path_missing');
		}
		const rootStat = await this.fileService.resolve(folder, { resolveMetadata: true });
		if (!rootStat.isDirectory) {
			return this.softFail(call, `not a directory: ${rel || '.'}`, 'path_not_dir');
		}

		const counter: IWalkCounter = { count: 0, dirs: 0, files: 0, bytes: 0, truncated: false };
		const treeLines: string[] = [];
		await walkDirectoryForList(this.fileService, rootStat, depth, includeHidden, maxEntries, counter, '', treeLines);

		const header = (rel === '' || rel === '.') ? this.relPath(this.workspaceRoot) + '/' : rel.replace(/\/+$/, '') + '/';
		const sizeStr = formatBytes(counter.bytes);
		const summary = `${counter.files} file${counter.files === 1 ? '' : 's'}, ${counter.dirs} ${counter.dirs === 1 ? 'directory' : 'directories'} · ${sizeStr}${counter.truncated ? ` (truncated at ${maxEntries} entries)` : ''}`;
		const body = treeLines.length > 0 ? treeLines.join('\n') : '(empty)';

		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({
				ok: true,
				path: rel || '.',
				depth,
				file_count: counter.files,
				dir_count: counter.dirs,
				bytes_total: counter.bytes,
				truncated: counter.truncated,
				output: `${header}\n${body}\n\n${summary}`,
			}),
		};
	}

	private async webSearch(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{
			query?: unknown;
			max_results?: unknown;
			freshness?: unknown;
			site_filter?: unknown;
			provider?: unknown;
		}>(call);

		if (typeof args.query !== 'string' || args.query.trim().length === 0) {
			return this.softFail(call, '`query` must be a non-empty string', 'invalid_arguments');
		}
		const query = args.query.trim();
		if (query.length > 500) {
			return this.softFail(call, '`query` too long (max 500 chars)', 'invalid_arguments');
		}
		const maxResults = clampInt(args.max_results, 8, 1, 20);
		const allowedFreshness: ReadonlyArray<string> = ['', 'pd', 'pw', 'pm', 'py'];
		const freshness = typeof args.freshness === 'string' && allowedFreshness.includes(args.freshness)
			? args.freshness
			: '';
		const siteFilter = typeof args.site_filter === 'string' ? args.site_filter.trim().slice(0, 200) : '';
		const allowedProviders: ReadonlyArray<string> = ['', 'brave', 'tavily', 'duckduckgo'];
		const provider = typeof args.provider === 'string' && allowedProviders.includes(args.provider)
			? args.provider
			: '';

		if (!this.authService) {
			return this.fail(call, 'alaska_web_search requires an authenticated session — auth service not wired');
		}

		const bodyObj = { query, max_results: maxResults, freshness, site_filter: siteFilter, provider };
		const bodyStr = JSON.stringify(bodyObj);

		const sent = await this.signedPost('/api/ai/web_search', bodyStr, call);
		if ('softFail' in sent) { return sent.softFail; }
		const res = sent.res;
		const text = sent.body;

		if (res.status === 401) {
			return this.softFail(call, 'session expired — sign in again', 'unauthorized');
		}
		if (res.status === 403) {
			let message = 'web_search quota exhausted or forbidden';
			try {
				const err = JSON.parse(text) as { message?: string; code?: string };
				if (err.message) { message = err.message; }
				const code = err.code === 'web_search_quota_exhausted' ? 'quota_exhausted' : 'forbidden';
				return this.softFail(call, message, code);
			} catch {
				return this.softFail(call, message, 'forbidden');
			}
		}
		if (!res.ok) {
			return this.softFail(call, `search backend HTTP ${res.status}: ${parseAlaskaApiError(res.status, text)}`, 'backend_error');
		}

		let body: {
			provider?: string;
			hits?: Array<{ title?: string; url?: string; snippet?: string; published_at?: string }>;
			cached?: boolean;
			truncated?: boolean;
			latency_ms?: number;
			hit_count?: number;
		};
		try {
			body = JSON.parse(text);
		} catch {
			return this.softFail(call, 'invalid json from search backend', 'backend_error');
		}
		const hits = Array.isArray(body.hits) ? body.hits.filter(h => typeof h?.url === 'string' && h.url.length > 0) : [];
		const providerUsed = typeof body.provider === 'string' ? body.provider : (provider || 'brave');
		const cached = body.cached === true;
		const truncated = body.truncated === true;
		const rendered = renderWebSearchOutput(hits, query, providerUsed, cached, truncated);

		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({
				ok: true,
				provider: providerUsed,
				hit_count: hits.length,
				cached,
				truncated,
				latency_ms: typeof body.latency_ms === 'number' ? body.latency_ms : 0,
				output: rendered,
			}),
		};
	}

	private async webFetch(call: IAlaskaToolCall): Promise<IAlaskaToolResult> {
		const args = this.parseArgs<{
			url?: unknown;
			format?: unknown;
			max_bytes?: unknown;
		}>(call);

		if (typeof args.url !== 'string' || args.url.trim().length === 0) {
			return this.softFail(call, '`url` must be a non-empty string', 'invalid_arguments');
		}
		const url = args.url.trim();
		if (!/^https?:\/\//i.test(url)) {
			return this.softFail(call, '`url` must start with http:// or https:// — relative or scheme-less URLs are rejected', 'invalid_url');
		}
		if (url.length > 4096) {
			return this.softFail(call, '`url` too long (max 4096 chars)', 'invalid_url');
		}
		const allowedFormats: ReadonlyArray<string> = ['markdown', 'html', 'text'];
		const format = typeof args.format === 'string' && allowedFormats.includes(args.format)
			? args.format
			: 'markdown';
		const maxBytes = clampInt(args.max_bytes, 200_000, 1024, 5_000_000);

		if (!this.authService) {
			return this.fail(call, 'alaska_web_fetch requires an authenticated session — auth service not wired');
		}

		const bodyObj = { url, format, max_bytes: maxBytes };
		const bodyStr = JSON.stringify(bodyObj);

		const sent = await this.signedPost('/api/ai/web_fetch', bodyStr, call);
		if ('softFail' in sent) { return sent.softFail; }
		const res = sent.res;
		const text = sent.body;

		if (res.status === 401) {
			return this.softFail(call, 'session expired — sign in again', 'unauthorized');
		}
		if (res.status === 400) {
			try {
				const err = JSON.parse(text) as { code?: string; message?: string };
				const msg = err.message || 'bad url';
				const code = err.code === 'web_fetch_blocked' ? 'blocked'
					: err.code === 'web_fetch_dns_failed' ? 'dns_failed'
					: 'invalid_url';
				return this.softFail(call, msg, code);
			} catch {
				return this.softFail(call, `bad url: ${text || 'no detail'}`, 'invalid_url');
			}
		}
		if (res.status === 403) {
			try {
				const err = JSON.parse(text) as { message?: string };
				return this.softFail(call, err.message || 'web_fetch quota exhausted', 'quota_exhausted');
			} catch {
				return this.softFail(call, 'web_fetch quota exhausted', 'quota_exhausted');
			}
		}
		if (res.status === 504) {
			return this.softFail(call, 'fetch timed out — upstream took too long', 'timeout');
		}
		if (!res.ok) {
			return this.softFail(call, `fetch backend HTTP ${res.status}: ${parseAlaskaApiError(res.status, text)}`, 'backend_error');
		}

		let body: {
			content?: string;
			content_type?: string;
			title?: string;
			byte_count?: number;
			truncated?: boolean;
			fetched_at?: string;
			cached?: boolean;
			latency_ms?: number;
			final_url?: string;
			status_code?: number;
		};
		try {
			body = JSON.parse(text);
		} catch {
			return this.softFail(call, 'invalid json from fetch backend', 'backend_error');
		}
		if (typeof body.content !== 'string' || body.content.length === 0) {
			return this.softFail(call, 'empty content from fetch backend', 'empty_response');
		}

		const finalURL = typeof body.final_url === 'string' && body.final_url ? body.final_url : url;
		const contentType = typeof body.content_type === 'string' ? body.content_type : 'text/plain';
		const title = typeof body.title === 'string' ? body.title : '';
		const byteCount = typeof body.byte_count === 'number' ? body.byte_count : body.content.length;
		const truncated = body.truncated === true;
		const cached = body.cached === true;
		const rendered = renderWebFetchOutput({
			content: body.content,
			contentType,
			title,
			byteCount,
			truncated,
			finalURL,
			originalURL: url,
		});

		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({
				ok: true,
				final_url: finalURL,
				content_type: contentType,
				byte_count: byteCount,
				truncated,
				title,
				cached,
				latency_ms: typeof body.latency_ms === 'number' ? body.latency_ms : 0,
				output: rendered,
			}),
		};
	}

	private async signedPost(path: string, body: string, call: IAlaskaToolCall): Promise<{ res: Response; body: string } | { softFail: IAlaskaToolResult }> {
		if (!this.authService) {
			return { softFail: this.fail(call, 'auth service not wired') };
		}
		try {
			await this.authService.getFreshAccessToken();
		} catch (err) {
			return { softFail: this.softFail(call, `auth refresh failed: ${err instanceof Error ? err.message : String(err)}`, 'auth_failed') };
		}
		const creds = await this.authService.getCredentials();
		const userId = this.authService.state.user?.id;
		if (!creds || !userId) {
			return { softFail: this.softFail(call, 'not signed in — run "Xipher IDE: Sign In" from the command palette', 'unauthorized') };
		}
		let headers: Record<string, string>;
		try {
			headers = await buildSignedHeaders(creds, userId, { method: 'POST', path, body });
		} catch (err) {
			return { softFail: this.softFail(call, err instanceof Error ? err.message : String(err), 'auth_failed') };
		}
		let res: Response;
		try {
			res = await fetch(`${ALASKA_API_BASE}${path}`, {
				method: 'POST',
				headers,
				body,
				signal: abortSignalFrom(CancellationToken.None),
			});
		} catch (err) {
			return { softFail: this.softFail(call, `network error contacting alaska backend: ${err instanceof Error ? err.message : String(err)}`, 'network_error') };
		}
		const text = await res.text().catch(() => '');
		return { res, body: text };
	}

	private relPath(uri: URI): string {
		const rootPath = this.workspaceRoot.path.replace(/\/+$/, '');
		const uriPath = uri.path;
		if (uriPath === rootPath) {
			const parts = rootPath.split('/').filter(Boolean);
			return parts[parts.length - 1] ?? rootPath;
		}
		if (uriPath.startsWith(rootPath + '/')) {
			return uriPath.slice(rootPath.length + 1);
		}
		return uri.fsPath;
	}

	private fail(call: IAlaskaToolCall, reason: string): IAlaskaToolResult {
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({ ok: false, error: reason }),
		};
	}

	private softFail(call: IAlaskaToolCall, reason: string, code?: string): IAlaskaToolResult {
		return {
			callId: call.id,
			name: call.name,
			content: JSON.stringify({ ok: false, error: reason, soft: true, code }),
		};
	}

	private async suggestSimilarFile(path: string): Promise<string | undefined> {
		const clean = path.replace(/\\/g, '/').replace(/^\/+/, '');
		const segments = clean.split('/').filter(Boolean);
		if (segments.length === 0) {
			return undefined;
		}
		const filename = segments[segments.length - 1];
		if (filename.length === 0 || filename.length > 200) {
			return undefined;
		}
		const baseDirSegments = segments.slice(0, -1);
		let baseUri: URI;
		try {
			baseUri = baseDirSegments.length > 0 ? joinPath(this.workspaceRoot, ...baseDirSegments) : this.workspaceRoot;
		} catch {
			return undefined;
		}
		try {
			const stat = await this.fileService.resolve(baseUri);
			if (!stat.isDirectory || !stat.children || stat.children.length === 0) {
				return undefined;
			}
			if (stat.children.length > 1000) {
				return undefined;
			}
			let best: { name: string; score: number } | undefined;
			for (const child of stat.children) {
				const score = fuzzyScore(child.name, filename);
				if (score === undefined) { continue; }
				if (!best || score < best.score) {
					best = { name: child.name, score };
				}
			}
			if (!best) { return undefined; }
			return baseDirSegments.length > 0 ? `${baseDirSegments.join('/')}/${best.name}` : best.name;
		} catch {
			return undefined;
		}
	}

	private tryParseArgs(call: IAlaskaToolCall): unknown {
		try {
			return JSON.parse(call.argumentsJson || '{}');
		} catch {
			return { raw: call.argumentsJson };
		}
	}

	private parseArgs<T>(call: IAlaskaToolCall): T {
		const raw = call.argumentsJson.trim();
		// eslint-disable-next-line local/code-no-dangerous-type-assertions
		if (!raw) { return {} as T; }
		try {
			return JSON.parse(raw) as T;
		} catch (err) {
			const rescued = rescueTruncatedArgs(raw, call.name);
			if (rescued) {
				this.logService?.trace(`[alaska.tools] rescued truncated args for ${call.name} (raw ${raw.length} bytes)`);
				return rescued as T;
			}
			const parseMsg = err instanceof Error ? err.message : String(err);
			this.logService?.warn(`[alaska.tools] tool args parse failed for ${call.name}: ${parseMsg}`);
			throw new AlaskaToolParseError(call.name, raw, parseMsg);
		}
	}

	resolveSafe(rel: string): URI {
		const trimmed = rel.trim();
		if (!trimmed) {
			throw new AlaskaToolSoftError('`path` must not be empty — model may still be streaming it', 'path_not_ready');
		}
		if (trimmed.startsWith('/') || trimmed.match(/^[a-zA-Z]:[\\/]/)) {
			throw new Error('absolute paths are not allowed — use a workspace-relative path');
		}
		const normalised = trimmed.replace(/\\/g, '/');
		const parts = normalised.split('/').filter(p => p && p !== '.');
		if (parts.some(p => p === '..')) {
			throw new Error('".." segments are not allowed');
		}
		const target = joinPath(this.workspaceRoot, ...parts);
		if (!isEqualOrParent(target, this.workspaceRoot)) {
			throw new Error('resolved path escapes the workspace root, denying.');
		}
		return target;
	}

	async assertNoSymlinkInPath(target: URI): Promise<void> {
		let cursor = target;
		const seen = new Set<string>();
		while (!isEqual(cursor, this.workspaceRoot)) {
			const key = cursor.toString();
			if (seen.has(key)) {
				return;
			}
			seen.add(key);
			try {
				const stat = await this.fileService.resolve(cursor, { resolveMetadata: false });
				if (stat.isSymbolicLink) {
					throw new Error(`refusing operation: path segment "${cursor.toString()}" is a symbolic link. Symlinks let an attacker redirect writes outside the workspace.`);
				}
			} catch (err) {
				if (err instanceof Error && err.message.startsWith('refusing operation:')) {
					throw err;
				}
			}
			const parent = uriDirname(cursor);
			if (isEqual(parent, cursor)) {
				return;
			}
			cursor = parent;
		}
	}
}

function ensureString(value: unknown, name: string): string {
	if (typeof value !== 'string') {
		throw new AlaskaToolSoftError(`\`${name}\` is not ready — the model has not finished streaming this argument yet`, `${name}_not_ready`);
	}
	return value;
}

function bytesOf(s: string): number {
	return new TextEncoder().encode(s).byteLength;
}

// Coerce an optional tool arg to a positive integer, or undefined.
function toPosInt(value: unknown): number | undefined {
	const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

const DEFAULT_EXCLUDE_DIR_NAMES: ReadonlySet<string> = new Set([
	'node_modules', '.git', '.svn', '.hg',
	'out', 'dist', 'build', '.build', '.next', '.nuxt', '.cache', '.parcel-cache',
	'vendor', 'target', '__pycache__', '.pytest_cache', '.venv', 'venv',
	'.idea', '.vscode-test', '.gradle', 'bin', 'obj',
]);

const DEFAULT_EXCLUDE_GLOBS: IExpression = {
	'**/node_modules/**': true,
	'**/.git/**': true,
	'**/.svn/**': true,
	'**/.hg/**': true,
	'**/out/**': true,
	'**/dist/**': true,
	'**/build/**': true,
	'**/.build/**': true,
	'**/.next/**': true,
	'**/.nuxt/**': true,
	'**/.cache/**': true,
	'**/.parcel-cache/**': true,
	'**/vendor/**': true,
	'**/target/**': true,
	'**/__pycache__/**': true,
	'**/.pytest_cache/**': true,
	'**/.venv/**': true,
	'**/venv/**': true,
	'**/.idea/**': true,
	'**/.vscode-test/**': true,
	'**/.gradle/**': true,
	'**/bin/**': true,
	'**/obj/**': true,
	'**/.DS_Store': true,
};

export function renderWebSearchOutput(
	hits: ReadonlyArray<{ title?: string; url?: string; snippet?: string; published_at?: string }>,
	query: string,
	provider: string,
	cached: boolean,
	truncated: boolean,
): string {
	if (hits.length === 0) {
		return `No web results for \`${query}\` (provider: ${provider})`;
	}
	const flags: string[] = [];
	if (cached) { flags.push('cached'); }
	if (truncated) { flags.push('truncated'); }
	const flagsSuffix = flags.length > 0 ? ` · ${flags.join(' · ')}` : '';
	const lines: string[] = [
		`${hits.length} web results for \`${query}\` (provider: ${provider}${flagsSuffix})`,
		'',
	];
	for (let i = 0; i < hits.length; i++) {
		const h = hits[i];
		const title = (h.title && h.title.trim()) ? h.title.trim() : (h.url ?? 'link');
		const url = h.url ?? '';
		lines.push(`${i + 1}. **${title}**`);
		if (url) { lines.push(`   ${url}`); }
		if (h.snippet) {
			const compact = h.snippet.length > 240 ? h.snippet.slice(0, 240) + '…' : h.snippet;
			lines.push(`   ${compact}`);
		}
		if (h.published_at) { lines.push(`   _${h.published_at}_`); }
		lines.push('');
	}
	return lines.join('\n').trimEnd();
}

export function renderWebFetchOutput(input: {
	content: string;
	contentType: string;
	title: string;
	byteCount: number;
	truncated: boolean;
	finalURL: string;
	originalURL: string;
}): string {
	const lines: string[] = [];
	const heading = input.title || input.finalURL;
	lines.push(`# Fetched ${heading}`);
	lines.push('');
	lines.push(`**URL**: ${input.finalURL}`);
	if (input.finalURL !== input.originalURL) {
		lines.push(`**Original**: ${input.originalURL}`);
	}
	const sizeStr = formatBytes(input.byteCount);
	const truncStr = input.truncated ? ' (truncated)' : '';
	lines.push(`**Type**: ${input.contentType} · **Size**: ${sizeStr}${truncStr}`);
	lines.push('');
	lines.push('---');
	lines.push('');
	lines.push(input.content);
	if (input.truncated) {
		lines.push('');
		lines.push('_(Content was truncated. Re-fetch with higher max_bytes if you need more.)_');
	}
	return lines.join('\n');
}

export function clampInt(raw: unknown, def: number, min: number, max: number): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) { return def; }
	const n = Math.floor(raw);
	if (n < min) { return min; }
	if (n > max) { return max; }
	return n;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) { return `${bytes} b`; }
	if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} kb`; }
	if (bytes < 1024 * 1024 * 1024) { return `${(bytes / 1024 / 1024).toFixed(1)} mb`; }
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} gb`;
}

interface IRenderedGrep {
	readonly text: string;
	readonly totalMatches: number;
	readonly truncated: boolean;
}

export function renderGrepResults(
	files: readonly IFileMatch[],
	pattern: string,
	regex: boolean,
	maxResults: number,
	toRelPath: (uri: URI) => string,
): IRenderedGrep {
	if (files.length === 0) {
		return { text: `No matches for ${regex ? 'regex' : 'pattern'} \`${pattern}\``, totalMatches: 0, truncated: false };
	}
	const lines: string[] = [];
	let totalMatches = 0;
	let truncated = false;
	let renderedFiles = 0;
	for (const file of files) {
		if (totalMatches >= maxResults) { truncated = true; break; }
		const fileMatches: ITextSearchMatch[] = [];
		for (const r of file.results ?? []) {
			if (resultIsMatch(r)) { fileMatches.push(r); }
		}
		if (fileMatches.length === 0) { continue; }
		const fileHeader = toRelPath(file.resource);
		lines.push(fileHeader);
		for (const m of fileMatches) {
			if (totalMatches >= maxResults) { truncated = true; break; }
			const lineNumber = previewLineNumber(m) + 1;
			const previewText = m.previewText ?? '';
			const oneLine = previewText.replace(/\r?\n/g, ' ').replace(/\s+$/g, '');
			const compact = oneLine.length > 200 ? oneLine.slice(0, 200) + '…' : oneLine;
			lines.push(`  ${lineNumber}: ${compact}`);
			totalMatches++;
		}
		lines.push('');
		renderedFiles++;
	}
	const headerSummary = truncated
		? `${totalMatches} matches in ${renderedFiles} file${renderedFiles === 1 ? '' : 's'} (truncated at ${maxResults})`
		: `${totalMatches} matches in ${renderedFiles} file${renderedFiles === 1 ? '' : 's'}`;
	return { text: `${headerSummary}\n\n${lines.join('\n').trimEnd()}`, totalMatches, truncated };
}

function previewLineNumber(match: ITextSearchMatch): number {
	const locs = match.rangeLocations;
	if (locs && locs.length > 0 && locs[0].source) {
		return Math.max(0, locs[0].source.startLineNumber - 1);
	}
	return 0;
}

interface IWalkCounter {
	count: number;
	dirs: number;
	files: number;
	bytes: number;
	truncated: boolean;
}

export async function walkDirectoryForList(
	fileService: IFileService,
	rootStat: IFileStat,
	remainingDepth: number,
	includeHidden: boolean,
	maxEntries: number,
	counter: IWalkCounter,
	prefix: string,
	out: string[],
): Promise<void> {
	if (counter.truncated) { return; }
	let stat = rootStat;
	if (!stat.children) {
		try { stat = await fileService.resolve(rootStat.resource, { resolveMetadata: true }); }
		catch { return; }
	}
	if (!stat.children) { return; }

	const filtered = stat.children
		.filter(c => includeHidden || !c.name.startsWith('.'))
		.filter(c => !DEFAULT_EXCLUDE_DIR_NAMES.has(c.name))
		.sort((a, b) => {
			if (a.isDirectory !== b.isDirectory) { return a.isDirectory ? -1 : 1; }
			return a.name.localeCompare(b.name);
		});

	for (let i = 0; i < filtered.length; i++) {
		if (counter.count >= maxEntries) { counter.truncated = true; return; }
		const child = filtered[i];
		const isLast = i === filtered.length - 1;
		const branch = isLast ? '└── ' : '├── ';
		const continuation = isLast ? '    ' : '│   ';
		const sizeStr = child.isDirectory ? '' : ` (${formatBytes(child.size ?? 0)})`;
		out.push(`${prefix}${branch}${child.name}${child.isDirectory ? '/' : ''}${sizeStr}`);
		counter.count++;
		if (child.isDirectory) {
			counter.dirs++;
		} else {
			counter.files++;
			counter.bytes += child.size ?? 0;
		}
		if (child.isDirectory && remainingDepth > 0) {
			await walkDirectoryForList(fileService, child, remainingDepth - 1, includeHidden, maxEntries, counter, prefix + continuation, out);
		}
	}
}

export class AlaskaToolParseError extends Error {
	readonly kind = 'tool-parse-error' as const;
	readonly toolName: string;
	readonly raw: string;
	readonly parseCause: string;
	constructor(toolName: string, raw: string, parseCause: string) {
		const preview = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
		super(`tool ${toolName} arguments could not be parsed (${parseCause}). Upstream stream truncated mid-call. First bytes: ${preview}`);
		this.name = 'AlaskaToolParseError';
		this.toolName = toolName;
		this.raw = raw;
		this.parseCause = parseCause;
	}
}

export function isAlaskaToolParseError(err: unknown): err is AlaskaToolParseError {
	return err instanceof AlaskaToolParseError
		|| (typeof err === 'object' && err !== null && (err as { kind?: unknown }).kind === 'tool-parse-error');
}

export class AlaskaToolSoftError extends Error {
	readonly kind = 'tool-soft-error' as const;
	readonly code: string;
	constructor(reason: string, code: string) {
		super(reason);
		this.name = 'AlaskaToolSoftError';
		this.code = code;
	}
}

export function isAlaskaToolSoftError(err: unknown): err is AlaskaToolSoftError {
	return err instanceof AlaskaToolSoftError
		|| (typeof err === 'object' && err !== null && (err as { kind?: unknown }).kind === 'tool-soft-error');
}

interface IAutoClosed {
	readonly text: string;
	readonly stringWasOpen: boolean;
}

function tryBalancedParse(raw: string): { value: unknown; closed: IAutoClosed } | undefined {
	const closed = autoCloseJson(raw);
	if (closed === undefined) {
		return undefined;
	}
	try {
		return { value: JSON.parse(closed.text), closed };
	} catch {
		return undefined;
	}
}

function autoCloseJson(raw: string): IAutoClosed | undefined {
	const stack: Array<'{' | '['> = [];
	let inString = false;
	let escape = false;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (escape) {
			escape = false;
			continue;
		}
		if (inString) {
			if (ch === '\\') {
				escape = true;
				continue;
			}
			if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') { stack.push('{'); continue; }
		if (ch === '[') { stack.push('['); continue; }
		if (ch === '}') {
			if (stack.pop() !== '{') { return undefined; }
			continue;
		}
		if (ch === ']') {
			if (stack.pop() !== '[') { return undefined; }
			continue;
		}
	}
	const stringWasOpen = inString;
	let trimmedTail = raw;
	if (inString) {
		trimmedTail += '"';
	}
	trimmedTail = trimmedTail.replace(/,\s*$/, '');
	for (let i = stack.length - 1; i >= 0; i--) {
		trimmedTail += stack[i] === '{' ? '}' : ']';
	}
	return { text: trimmedTail, stringWasOpen };
}

function rescueTruncatedArgs(raw: string, toolName: string): Record<string, unknown> | undefined {
	const balanced = tryBalancedParse(raw);
	if (balanced && typeof balanced.value === 'object' && balanced.value !== null) {
		const obj = balanced.value as Record<string, unknown>;
		if (balanced.closed.stringWasOpen
			&& (toolName === 'alaska_write_file' || toolName === 'alaska_patch_file')
			&& typeof obj.content === 'string') {
			obj._content_truncated = true;
		}
		return obj;
	}
	if (toolName !== 'alaska_write_file' && toolName !== 'alaska_patch_file' && toolName !== 'alaska_delete_file' && toolName !== 'alaska_read_file') {
		return undefined;
	}
	const path = extractStringField(raw, 'path');
	if (toolName === 'alaska_delete_file' || toolName === 'alaska_read_file') {
		return path ? { path } : undefined;
	}
	if (toolName === 'alaska_patch_file') {
		const find = extractStringField(raw, 'find');
		const replace = extractStringField(raw, 'replace');
		if (!path || find === undefined || replace === undefined) {
			return undefined;
		}
		return { path, find, replace };
	}
	const content = extractStringField(raw, 'content');
	if (!path || content === undefined) {
		return undefined;
	}
	return { path, content };
}

function fuzzyScore(candidate: string, target: string): number | undefined {
	if (candidate === target) {
		return 0;
	}
	const a = candidate.toLowerCase();
	const b = target.toLowerCase();
	if (a === b) {
		return 1;
	}
	if (a.startsWith(b) || b.startsWith(a)) {
		return Math.abs(a.length - b.length);
	}
	if (Math.abs(a.length - b.length) > 2 || a.length > 200 || b.length > 200) {
		return undefined;
	}
	const distance = levenshtein(a, b);
	return distance <= 2 ? 2 + distance : undefined;
}

function levenshtein(a: string, b: string): number {
	const al = a.length;
	const bl = b.length;
	if (al === 0) { return bl; }
	if (bl === 0) { return al; }
	let prev: number[] = new Array(bl + 1);
	let curr: number[] = new Array(bl + 1);
	for (let j = 0; j <= bl; j++) { prev[j] = j; }
	for (let i = 1; i <= al; i++) {
		curr[0] = i;
		for (let j = 1; j <= bl; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}
	return prev[bl];
}

export function partialArgsMissingPath(raw: string): boolean {
	if (!raw) {
		return false;
	}
	const hasContent = extractStringField(raw, 'content') !== undefined;
	const hasPath = extractStringField(raw, 'path') !== undefined;
	return hasContent && !hasPath;
}

export function tryPartialPath(argumentsJson: string): string | undefined {
	if (!argumentsJson) {
		return undefined;
	}
	try {
		const obj = JSON.parse(argumentsJson) as Record<string, unknown>;
		const p = obj['path'];
		if (typeof p === 'string') {
			return p;
		}
	} catch {
		return extractStringField(argumentsJson, 'path');
	}
	return undefined;
}

export function tryPartialContent(argumentsJson: string): string | undefined {
	return tryPartialStringField(argumentsJson, 'content');
}

export function tryPartialReplace(argumentsJson: string): string | undefined {
	return tryPartialStringField(argumentsJson, 'replace');
}

function tryPartialStringField(argumentsJson: string, field: 'content' | 'replace'): string | undefined {
	if (!argumentsJson) {
		return undefined;
	}
	try {
		const obj = JSON.parse(argumentsJson) as Record<string, unknown>;
		const v = obj[field];
		if (typeof v === 'string') {
			return v;
		}
	} catch {
		return extractStringField(argumentsJson, field);
	}
	return undefined;
}

export function tryStablePath(argumentsJson: string): string | undefined {
	if (!argumentsJson) {
		return undefined;
	}
	try {
		const obj = JSON.parse(argumentsJson) as Record<string, unknown>;
		const p = obj['path'];
		if (typeof p === 'string' && p.length > 0) {
			return p;
		}
	} catch {
		/* not yet valid JSON — fall through to regex with closing-quote requirement */
	}
	const m = /"path"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(argumentsJson);
	if (m && m[1].length > 0) {
		return m[1];
	}
	return undefined;
}

function extractStringField(raw: string, field: string): string | undefined {
	const re = new RegExp(`"${field}"\\s*:\\s*"`, 'g');
	const m = re.exec(raw);
	if (!m) {
		return undefined;
	}
	const start = m.index + m[0].length;
	let i = start;
	let out = '';
	while (i < raw.length) {
		const ch = raw[i];
		if (ch === '\\') {
			if (i + 1 >= raw.length) {
				return out;
			}
			const esc = raw[i + 1];
			switch (esc) {
				case '"': out += '"'; i += 2; continue;
				case '\\': out += '\\'; i += 2; continue;
				case '/': out += '/'; i += 2; continue;
				case 'b': out += '\b'; i += 2; continue;
				case 'f': out += '\f'; i += 2; continue;
				case 'n': out += '\n'; i += 2; continue;
				case 'r': out += '\r'; i += 2; continue;
				case 't': out += '\t'; i += 2; continue;
				case 'u': {
					if (i + 6 > raw.length) {
						return out;
					}
					const hex = raw.slice(i + 2, i + 6);
					if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
						return out;
					}
					out += String.fromCharCode(parseInt(hex, 16));
					i += 6;
					continue;
				}
				default:
					out += esc;
					i += 2;
					continue;
			}
		}
		if (ch === '"') {
			return out;
		}
		out += ch;
		i++;
	}
	return out;
}
