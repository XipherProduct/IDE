// Server-side agent turn loop — the port of the desktop's submit() loop.
//
// Given a user message on a session, it drives the model↔tool cycle to
// completion: each round it (1) gates spend on the site ledger, (2) checks model
// access against the live plan, (3) streams a completion from OmniRoute, (4)
// persists the assistant turn, (5) dispatches any tool calls through the
// session's Executor and persists the results, then loops until the model stops
// calling tools (or a cap / cancellation / quota stop is hit).
//
// Every frame is published to the session bus so the originating browser, other
// tabs, and (Phase 3) the desktop IDE all see the same live stream.

import { omniChatStream } from './omniroute.mjs';
import { buildOpenAIBody, chunkToFrames } from './translate.mjs';
import { MODEL_MAP, DEFAULT_MODEL, modelMultiplier } from './models.mjs';
import { modelAllowed, planOf, canAfford, charge as localCharge } from './plans.mjs';
import { userPlan, syncUserPlan } from './auth.mjs';
import { siteAuthorize, siteCharge } from './siteClient.mjs';
import * as store from './agentStore.mjs';
import * as bus from './agentBus.mjs';
import { resolveExecutor } from './serverExecutor.mjs';
import { toolsForMode, isReadOnlyTool } from './agentTools.mjs';
import { buildSystemPrompt } from './agentPrompt.mjs';
import { recall } from './memory.mjs';

const MAX_ROUNDS = 40;          // hard cap on model↔tool cycles per user turn
const MAX_EMPTY_RETRIES = 1;    // one retry on an empty turn — a clean empty from Claude is usually a content decline, retrying won't change it
const MAX_STREAM_ERR_RETRIES = 3; // retries on a transient upstream error (bad-account rotation) before surfacing

// Assemble finalized tool calls from streamed tool_delta fragments (id/name/args
// arrive piecemeal across chunks, keyed by index).
function foldToolDeltas(acc, delta) {
	const i = delta.index ?? 0;
	const cur = acc[i] || (acc[i] = { id: '', name: '', arguments: '' });
	if (delta.id) { cur.id = delta.id; }
	if (delta.name) { cur.name = delta.name; }
	if (delta.arguments) { cur.arguments += delta.arguments; }
}

function parseArgs(argsJson) {
	try { return JSON.parse(argsJson || '{}'); } catch { return {}; }
}

const DEFAULT_TITLES = new Set(['new session', 'новая сессия', 'новый чат', 'чат', '']);
function isDefaultTitle(t) { return DEFAULT_TITLES.has(String(t || '').trim().toLowerCase()); }
// Derive a concise title from the first user message: first line, collapsed,
// cut on a word boundary ~42 chars, first letter capitalized.
function deriveTitle(content) {
	let t = String(content || '').replace(/\s+/g, ' ').trim().split('\n')[0];
	if (!t) { return ''; }
	if (t.length > 42) { const cut = t.slice(0, 42); const sp = cut.lastIndexOf(' '); t = (sp > 20 ? cut.slice(0, sp) : cut) + '…'; }
	return t.charAt(0).toUpperCase() + t.slice(1);
}

// Run one complete user turn. Serialized per-session via the store lock so two
// clients can't drive the same session concurrently.
export async function runTurn(params) {
	const { userId, sessionId } = params;
	return store.withSessionLock(sessionId, () => runTurnLocked(params));
}

async function runTurnLocked({ userId, sessionId, content }) {
	const session = store.getSession(userId, sessionId);
	if (!session) { return { ok: false, error: 'no_session' }; }

	// persist + broadcast the user message
	const userMsg = store.appendMessage(userId, sessionId, { role: 'user', content });
	bus.publish(sessionId, { message: userMsg });

	// auto-title the session from the first user message (like GPT/Cursor/Claude)
	if (isDefaultTitle(session.title)) {
		const title = deriveTitle(content);
		if (title) {
			const updated = store.touchSession(userId, sessionId, { title });
			if (updated) { session.title = updated.title; bus.publish(sessionId, { session: updated }); }
		}
	}

	const model = MODEL_MAP[session.model] ? session.model : DEFAULT_MODEL;
	const cost = modelMultiplier(model);
	const agentMode = session.agentMode || 'agent';
	const permissionMode = session.permissionMode || 'auto';
	const tools = toolsForMode(agentMode, permissionMode);
	const executor = resolveExecutor(session);

	const ac = new AbortController();
	bus.registerCanceller(sessionId, () => ac.abort());
	bus.setRunning(sessionId, true);
	let emptyRetries = 0;
	let streamErrRetries = 0;

	try {
		for (let round = 0; round < MAX_ROUNDS; round++) {
			if (ac.signal.aborted) { break; }

			// (1) spend gate on the site ledger (fall back to local ledger if the site is down)
			let plan = userPlan(userId);
			let useSite = false;
			const authz = await siteAuthorize(userId, cost);
			if (authz) {
				useSite = true;
				// Use the SITE plan directly for gating: a web-only user isn't in the
				// ide-backend auth store, so userPlan() would wrongly return 'free'.
				// syncUserPlan still updates desktop users who exist locally.
				if (authz.plan) { syncUserPlan(userId, authz.plan); plan = authz.plan; }
				if (!authz.ok) {
					publishError(sessionId, userId, `Credit limit reached (${authz.window}).`, 'quota_exhausted');
					break;
				}
			} else {
				const afford = canAfford(userId, plan, cost);
				if (!afford.ok) {
					publishError(sessionId, userId, `Credit limit reached (${afford.window}).`, 'quota_exhausted');
					break;
				}
			}

			// (2) model access gate against the live plan
			if (!modelAllowed(plan, MODEL_MAP[model])) {
				publishError(sessionId, userId, `Model "${model}" requires a higher plan.`, 'model_locked');
				break;
			}

			// (3) build + stream the completion
			const memory = agentMode === 'chat' || round === 0 ? recall(userId) : [];
			const messages = [
				buildSystemPrompt({ agentMode, permissionMode, workspace: session.workspace, memory }),
				...store.conversationForModel(userId, sessionId),
			];
			const body = buildOpenAIBody({ model, messages, tools, reasoningEffort: session.reasoningEffort });

			let text = '';
			let reasoning = '';
			const toolAcc = [];
			const state = { finish: undefined, usage: undefined };
			let charged = false;
			let streamErr = null;
			try {
				for await (const chunk of omniChatStream(body, ac.signal)) {
					for (const f of chunkToFrames(chunk, state)) {
						if (f.reasoning) { reasoning += f.reasoning; }
						if (f.delta) { text += f.delta; }
						if (f.tool_delta) { foldToolDeltas(toolAcc, f.tool_delta); }
						if ((f.delta || f.tool_delta) && !charged) { charged = true; if (useSite) { void siteCharge(userId, cost, model); } else { localCharge(userId, cost); } } // charge once real output flows — never for an empty/failed turn
						bus.publish(sessionId, f);
					}
				}
			} catch (e) {
				if (ac.signal.aborted) { break; }
				streamErr = e;
			}

			const toolCalls = toolAcc.filter(Boolean).filter(t => t.name);
			const producedNothing = !text.trim() && !reasoning.trim() && toolCalls.length === 0;

			// Transient upstream failure (OmniRoute rotating onto an unhealthy Claude
			// account → 502 / "invalid header" / credential exhaustion) with nothing
			// produced yet → retry the round a few times before surfacing; the next
			// rotation usually lands on a healthy account. This is what makes premium
			// models (opus-5/fable) reliable when part of their account pool is bad.
			if (streamErr) {
				if (producedNothing && streamErrRetries < MAX_STREAM_ERR_RETRIES) {
					streamErrRetries++;
					await new Promise(r => setTimeout(r, 400 * streamErrRetries));
					round--; // retry the same round
					continue;
				}
				publishError(sessionId, userId, 'Провайдер этой модели временно недоступен — попробуйте ещё раз или выберите другую модель.', 'stream_error');
				break;
			}

			// empty turn (no text, no tools) → retry once, else stop. A Claude model
			// that returns finish=stop with zero content is usually declining the
			// request by content (Anthropic returns an empty completion instead of a
			// text refusal) — say so plainly and point at models that will answer.
			if (producedNothing) {
				if (emptyRetries < MAX_EMPTY_RETRIES) { emptyRetries++; await new Promise(r => setTimeout(r, 300)); continue; }
				const isClaude = MODEL_MAP[model] && MODEL_MAP[model].provider === 'Claude';
				publishError(sessionId, userId, isClaude
					? 'Claude вернул пустой ответ — вероятно, отклонил запрос по содержимому. Переформулируйте задачу (например, в оборонительной формулировке) или выберите другую модель (DeepSeek, Qwen, Sonnet).'
					: 'Модель вернула пустой ответ — попробуйте отправить ещё раз.', 'empty_turn');
				break;
			}
			emptyRetries = 0;

			// (4) persist the assistant turn (with any tool calls) + broadcast
			const assistantMsg = store.appendMessage(userId, sessionId, {
				role: 'assistant',
				content: text,
				reasoning: reasoning || undefined,
				model,
				usage: state.usage,
				credits: cost,
				tool_calls: toolCalls.length ? toolCalls.map(t => ({
					id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments },
				})) : undefined,
			});
			bus.publish(sessionId, { message: assistantMsg });
			bus.publish(sessionId, { turn: { index: round, finish_reason: state.finish, usage: state.usage } });

			// no tool calls → the turn is complete
			if (toolCalls.length === 0) { break; }

			// (5) dispatch tool calls, persist results, broadcast activity
			for (const tc of toolCalls) {
				if (ac.signal.aborted) { break; }
				const args = parseArgs(tc.arguments);
				const result = await dispatchTool({ tc, args, session, executor, userId, sessionId, plan, permissionMode });
				const toolMsg = store.appendMessage(userId, sessionId, {
					role: 'tool', tool_call_id: tc.id, name: tc.name, content: result.content,
				});
				bus.publish(sessionId, { tool_result: { callId: tc.id, name: tc.name, content: result.content, edit: result.edit } });
				bus.publish(sessionId, { message: toolMsg });
			}
			// loop for the next round so the model can react to the tool results
		}

		bus.publish(sessionId, { done: { sessionId } });
		store.touchSession(userId, sessionId, {});
		return { ok: true };
	} finally {
		bus.setRunning(sessionId, false);
		bus.clearCanceller(sessionId);
	}
}

// Execute a single tool call. Handles the approval round-trip for announce_plan
// and enforces the permission mode (mutating tools are blocked in plan/readonly
// and, when a mode requires it, gated behind a fail-closed client approval).
async function dispatchTool({ tc, args, session, executor, userId, sessionId, plan, permissionMode }) {
	const name = tc.name;

	// plan/announce → approval round-trip
	if (name === 'alaska_announce_plan') {
		bus.publish(sessionId, { activity: { callId: tc.id, name, status: 'awaiting_approval', label: 'Plan proposed' } });
		const decision = await bus.awaitApproval(sessionId, tc.id);
		return { ok: true, content: JSON.stringify({ ok: true, approved: !!decision.approved, reason: decision.reason || null, plan: decision.plan || null }) };
	}

	// permission-mode gate for mutating tools
	if (!isReadOnlyTool(name)) {
		if (permissionMode === 'plan' || permissionMode === 'readonly') {
			return { ok: false, content: `Refused: ${name} is not allowed in ${permissionMode} mode.` };
		}
	}

	bus.publish(sessionId, { activity: { callId: tc.id, name, status: 'start', label: activityLabel(name, args) } });
	try {
		const r = await executor.dispatch(name, args, { userId, planId: planOf(plan).id, sessionId });
		return r;
	} catch (e) {
		return { ok: false, content: `Tool error: ${String(e && e.message || e)}` };
	}
}

function activityLabel(name, args) {
	switch (name) {
		case 'alaska_read_file': return `Read ${args.path || ''}`;
		case 'alaska_write_file': return `Write ${args.path || ''}`;
		case 'alaska_patch_file': return `Patch ${args.path || ''}`;
		case 'alaska_delete_file': return `Delete ${args.path || ''}`;
		case 'alaska_grep_search': return `Search "${args.pattern || ''}"`;
		case 'alaska_list_directory': return `List ${args.path || '.'}`;
		case 'alaska_run_command': return `Run: ${(args.command || '').slice(0, 60)}`;
		case 'alaska_web_search': return `Web search "${args.query || ''}"`;
		case 'alaska_web_fetch': return `Fetch ${args.url || ''}`;
		case 'alaska_open_browser': return `Open ${args.url || ''}`;
		default: return name;
	}
}

function publishError(sessionId, userId, message, code) {
	const msg = store.appendMessage(userId, sessionId, { role: 'error', content: message });
	bus.publish(sessionId, { error: { message, code } });
	if (msg) { bus.publish(sessionId, { message: msg }); }
}
