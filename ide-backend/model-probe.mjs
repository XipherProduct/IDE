// Probe omniroute model candidates for: reachability, non-empty output, tool-calling.
// Run ON the prod box: node model-probe.mjs   (hits localhost omniroute)
const BASE = 'http://127.0.0.1:20128/admin/provider/v1/chat/completions';
const CANDIDATES = process.argv.slice(2);

const TOOL = [{ type: 'function', function: { name: 'get_time', description: 'Get current time in a city', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }];

async function probe(model) {
	const t0 = Date.now();
	try {
		const ac = new AbortController();
		const to = setTimeout(() => ac.abort(), 60000);
		const r = await fetch(BASE, {
			method: 'POST', signal: ac.signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: 'What time is it in Tokyo? Use the get_time tool.' }],
				tools: TOOL, stream: false, max_tokens: 60,
			}),
		});
		clearTimeout(to);
		const ms = Date.now() - t0;
		const j = await r.json().catch(() => ({}));
		if (!r.ok || j.error) {
			return { model, ok: false, http: r.status, err: (j.error && (j.error.message || j.error.type)) || `HTTP ${r.status}`, ms };
		}
		const m = j.choices && j.choices[0] && j.choices[0].message;
		const tools = m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
		const text = (m && m.content || '').trim();
		const outTokens = j.usage && j.usage.completion_tokens;
		return { model, ok: true, http: r.status, tool_calls: !!tools, tool: tools ? m.tool_calls[0].function.name : null, empty: !tools && !text, out_tokens: outTokens, ms, sample: text.slice(0, 40) };
	} catch (e) {
		return { model, ok: false, err: String(e && e.message || e), ms: Date.now() - t0 };
	}
}

for (const model of CANDIDATES) {
	const r = await probe(model);
	const verdict = !r.ok ? `❌ ${r.err}` : r.tool_calls ? `✅ AGENT (tool: ${r.tool})` : r.empty ? '⚠️ EMPTY (0 tokens)' : `➖ text-only (no tool_calls, ${r.out_tokens}t)`;
	console.log(`${verdict.padEnd(34)} ${r.ms}ms  ${model}`);
}
