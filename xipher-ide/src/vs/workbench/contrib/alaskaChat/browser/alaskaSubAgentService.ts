/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAlaskaChatMessage, IAlaskaChatService } from './alaskaChatService.js';
import { IAlaskaTool, IAlaskaToolCall, IAlaskaToolResult, TOOL_DEFINITIONS, AlaskaToolExecutor } from './alaskaTools.js';

const SUBAGENT_READONLY_TOOLS = new Set<string>([
	'alaska_read_file',
	'alaska_grep_search',
	'alaska_list_directory',
	'alaska_web_search',
	'alaska_web_fetch',
]);

const MAX_SUB_TURNS = 6;
const MAX_DEPTH = 2;

export interface IAlaskaSubAgentContext {
	readonly depth: number;
	readonly token: CancellationToken;
	readonly toolExecutor: AlaskaToolExecutor | undefined;
	readonly chatService: IAlaskaChatService;
	readonly logService: ILogService;
}

export interface IAlaskaSubAgentArgs {
	readonly task: string;
	readonly expectedOutput: string;
	readonly parallelGroup?: string;
}

export function parseSubAgentArgs(call: IAlaskaToolCall): IAlaskaSubAgentArgs | undefined {
	try {
		const parsed = JSON.parse(call.argumentsJson) as Partial<IAlaskaSubAgentArgs>;
		if (typeof parsed.task !== 'string' || !parsed.task.trim()) { return undefined; }
		if (typeof parsed.expectedOutput !== 'string' && typeof (parsed as { expected_output?: string }).expected_output !== 'string') {
			return undefined;
		}
		const expected = typeof parsed.expectedOutput === 'string'
			? parsed.expectedOutput
			: (parsed as { expected_output?: string }).expected_output ?? '';
		const groupRaw = (parsed as { parallel_group?: string }).parallel_group;
		return {
			task: parsed.task.trim(),
			expectedOutput: expected,
			parallelGroup: typeof groupRaw === 'string' && groupRaw.trim() ? groupRaw.trim() : undefined,
		};
	} catch {
		return undefined;
	}
}

export async function dispatchSubAgent(call: IAlaskaToolCall, ctx: IAlaskaSubAgentContext): Promise<IAlaskaToolResult> {
	const args = parseSubAgentArgs(call);
	if (!args) {
		return fail(call, 'invalid_args: alaska_dispatch_subagent requires "task" and "expected_output"');
	}
	if (ctx.depth >= MAX_DEPTH) {
		return fail(call, 'depth_exceeded: sub-agents cannot spawn further sub-agents');
	}
	const turnTools: readonly IAlaskaTool[] = TOOL_DEFINITIONS.filter(t => SUBAGENT_READONLY_TOOLS.has(t.function.name));

	const systemPrompt = buildSubAgentSystemPrompt(args);
	const messages: IAlaskaChatMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: args.task },
	];

	const filesInspected: string[] = [];
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let summary = '';

	for (let turn = 0; turn < MAX_SUB_TURNS; turn++) {
		if (ctx.token.isCancellationRequested) {
			summary = '(sub-agent cancelled)';
			break;
		}
		const stream = ctx.chatService.stream({
			model: 'claude-haiku-4-5-20251001',
			messages: messages.slice(),
			tools: turnTools,
			reasoningEffort: 'low',
		}, ctx.token);

		let acc = '';
		const toolCalls: IAlaskaToolCall[] = [];
		const pendingTools = new Map<string, IAlaskaToolCall>();
		let lastError: string | undefined;
		for await (const ev of stream) {
			if (ev.kind === 'delta') { acc += ev.text; }
			else if (ev.kind === 'tool_call') {
				pendingTools.set(ev.call.id, ev.call);
				toolCalls.push(ev.call);
			} else if (ev.kind === 'done') {
				if (ev.usage) {
					totalInputTokens += ev.usage.input;
					totalOutputTokens += ev.usage.output;
				}
				break;
			} else if (ev.kind === 'error') {
				lastError = ev.message;
				break;
			}
		}
		if (lastError) {
			summary = `(sub-agent failed: ${lastError})`;
			break;
		}
		if (toolCalls.length === 0) {
			summary = acc.trim();
			break;
		}
		messages.push({
			role: 'assistant',
			content: acc,
			tool_calls: toolCalls.map(c => ({
				id: c.id,
				type: 'function' as const,
				function: { name: c.name, arguments: c.argumentsJson },
			})),
		});
		for (const tc of toolCalls) {
			if (!SUBAGENT_READONLY_TOOLS.has(tc.name)) {
				messages.push({
					role: 'tool',
					tool_call_id: tc.id,
					content: JSON.stringify({ ok: false, error: 'forbidden_tool: sub-agent restricted to read-only tools', soft: true }),
				});
				continue;
			}
			let subResult: IAlaskaToolResult;
			try {
				if (!ctx.toolExecutor) {
					subResult = fail(tc, 'no_workspace_root');
				} else {
					subResult = await ctx.toolExecutor.execute(tc);
				}
			} catch (err) {
				subResult = fail(tc, err instanceof Error ? err.message : String(err));
			}
			messages.push({ role: 'tool', content: subResult.content, tool_call_id: subResult.callId });
			if (tc.name === 'alaska_read_file') {
				try {
					const p = (JSON.parse(tc.argumentsJson) as { path?: string }).path;
					if (p) { filesInspected.push(p); }
				} catch { /* ignore */ }
			}
		}
		if (turn === MAX_SUB_TURNS - 1) {
			summary = '(sub-agent exhausted max turns without final summary)';
		}
	}

	return {
		callId: call.id,
		name: call.name,
		content: JSON.stringify({
			ok: true,
			task: args.task,
			summary,
			files_inspected: filesInspected,
			token_cost: totalInputTokens + totalOutputTokens,
			turns: Math.min(MAX_SUB_TURNS, filesInspected.length + 1),
		}),
	};
}

export interface IGroupedSubAgentBatch {
	readonly group: string;
	readonly calls: IAlaskaToolCall[];
}

export function groupSubAgentsByParallelGroup(calls: readonly IAlaskaToolCall[]): IGroupedSubAgentBatch[] {
	const groups = new Map<string, IAlaskaToolCall[]>();
	for (const call of calls) {
		const args = parseSubAgentArgs(call);
		const key = args?.parallelGroup ?? `__solo_${call.id}`;
		const bucket = groups.get(key);
		if (bucket) { bucket.push(call); }
		else { groups.set(key, [call]); }
	}
	return Array.from(groups.entries()).map(([group, batchCalls]) => ({ group, calls: batchCalls }));
}

function buildSubAgentSystemPrompt(args: IAlaskaSubAgentArgs): string {
	return [
		'You are a focused sub-agent dispatched by the main Xipher IDE agent.',
		'',
		`TASK: ${args.task}`,
		'',
		`EXPECTED OUTPUT FORMAT: ${args.expectedOutput || 'a 5-15 line summary citing specific files and line numbers'}`,
		'',
		'Rules:',
		'1. READ-ONLY tools only: alaska_read_file, alaska_grep_search, alaska_list_directory, alaska_web_search, alaska_web_fetch.',
		'2. You CANNOT write, edit, delete, run shell commands, or spawn further sub-agents.',
		'3. Complete the task in 6 tool turns or fewer.',
		'4. Your final message (NO tool calls) is your SUMMARY — that is what the main agent receives.',
		'5. Keep the summary CONCISE (5-15 lines). Cite specific files and line numbers.',
		'6. Do NOT include full file contents — extract only the parts that matter to the task.',
		'7. If the task is impossible or out of scope, return a single-line explanation.',
		'',
		'Begin investigation.',
	].join('\n');
}

function fail(call: IAlaskaToolCall, error: string): IAlaskaToolResult {
	return {
		callId: call.id,
		name: call.name,
		content: JSON.stringify({ ok: false, error, soft: true }),
	};
}
