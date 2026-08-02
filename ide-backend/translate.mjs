// Request ↔ OpenAI translation, shared by the single-turn chat proxy
// (server.mjs handleChat) and the server-side agent loop (agentLoop.mjs).
//
// Extracted verbatim from server.mjs so both paths build identical upstream
// bodies and decode identical frames — one source of truth, no drift.

import { resolveOmniId, MODEL_MAP } from './models.mjs';

// ---- request → OpenAI -------------------------------------------------------

export function contentToOpenAI(content) {
	if (typeof content === 'string') { return content; }
	if (Array.isArray(content)) {
		// flatten to text (image parts dropped — these models are text)
		return content.map(p => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
	}
	return '';
}

export function toOpenAIMessages(messages) {
	return (messages || []).map(m => {
		const out = { role: m.role, content: contentToOpenAI(m.content) };
		if (m.tool_call_id) { out.tool_call_id = m.tool_call_id; }
		if (m.tool_calls) { out.tool_calls = m.tool_calls; }
		if (m.name) { out.name = m.name; }
		return out;
	});
}

// Assistant turns that carry no signal and actively break the next completion:
// (1) our OWN error text, which the desktop persists as an assistant message and
// replays, and (2) empty assistant messages the desktop appends as placeholders.
// A conversation that ends with an empty assistant turn makes Claude return
// finish=stop with NO content (it reads it as an already-answered/empty prefill),
// which then persists another empty turn → a death spiral. deepseek tolerates it,
// opus-5/fable-5 do not. The web path is unaffected (it builds history server-side).
const ERROR_ECHO_RE = /Модель вернула пустой ответ|Провайдер этой модели временно недоступен|временная перегрузка провайдера|returned an empty response/i;

export function sanitizeConversation(messages) {
	const kept = [];
	for (const m of (messages || [])) {
		if (m && m.role === 'assistant') {
			const c = typeof m.content === 'string' ? m.content : '';
			const hasTools = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
			if (!hasTools && (!c.trim() || ERROR_ECHO_RE.test(c))) { continue; } // drop empty / error-echo assistant turns
		}
		kept.push(m);
	}
	// Merge consecutive same-role user/assistant text messages so removing the
	// above never leaves two same-role turns in a row (Anthropic requires strict
	// alternation and rejects otherwise).
	const merged = [];
	for (const m of kept) {
		const prev = merged[merged.length - 1];
		if (prev && prev.role === m.role && (m.role === 'user' || m.role === 'assistant')
			&& !prev.tool_calls && !m.tool_calls && !prev.tool_call_id && !m.tool_call_id
			&& typeof prev.content === 'string' && typeof m.content === 'string') {
			prev.content = (prev.content + '\n\n' + m.content).trim();
		} else {
			merged.push({ ...m });
		}
	}
	return merged;
}

export function buildOpenAIBody(req) {
	const model = resolveOmniId(req.model);
	const supportsEffort = !!(MODEL_MAP[req.model] && MODEL_MAP[req.model].reasoning);
	const body = {
		model,
		messages: toOpenAIMessages(sanitizeConversation(req.messages)),
	};
	if (req.tools && req.tools.length) { body.tools = req.tools; }
	if (supportsEffort && req.reasoningEffort) { body.reasoning_effort = req.reasoningEffort; }
	return body;
}

// ---- OpenAI chunk → Alaska SSE frame(s) ------------------------------------

// Decodes one upstream streaming chunk into zero or more wire frames and folds
// finish_reason / usage into `state`. The frame vocabulary is a superset the
// desktop parser (alaskaChatService) already understands, so the same decoder
// serves the desktop SSE endpoint and the web WebSocket relay.
export function chunkToFrames(chunk, state) {
	const frames = [];
	const choice = chunk && chunk.choices && chunk.choices[0];
	if (choice) {
		const d = choice.delta || {};
		const reasoning = d.reasoning_content ?? d.reasoning;
		if (reasoning) { frames.push({ reasoning }); }
		if (d.content) { frames.push({ delta: d.content }); }
		if (Array.isArray(d.tool_calls)) {
			for (const tc of d.tool_calls) {
				frames.push({
					tool_delta: {
						index: tc.index ?? 0,
						id: tc.id,
						name: tc.function && tc.function.name,
						arguments: tc.function && tc.function.arguments,
					},
				});
			}
		}
		if (choice.finish_reason) { state.finish = choice.finish_reason; }
	}
	if (chunk && chunk.usage) {
		state.usage = {
			input: chunk.usage.prompt_tokens ?? 0,
			output: chunk.usage.completion_tokens ?? 0,
		};
	}
	return frames;
}
