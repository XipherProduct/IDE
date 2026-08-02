import { useEffect, useRef, useState, useCallback } from 'react';
import { codeApi, CodeMessage, CodeModel } from '../lib/api';
import { AgentSocket, ServerFrame } from '../lib/agentWs';

interface Activity { callId: string; name: string; label: string; status: string; }
interface Pending { callId: string; label: string; }

export interface SendOpts { model?: string | null; agentMode?: string; permissionMode?: string; reasoningEffort?: string | null; }

// The live agent transcript for one session: history load, WebSocket relay,
// streaming text/reasoning/tool-activity, plan approval, and the composer.
// Reused by the Code session view and the regular Chat view.
export function AgentChat({ sessionId, sendOpts, models, emptyHint, onSession, onDone }: {
	sessionId: string;
	sendOpts: SendOpts;
	models: CodeModel[];
	emptyHint?: string;
	onSession?: (s: any) => void;
	onDone?: () => void;
}) {
	const [messages, setMessages] = useState<CodeMessage[]>([]);
	const [streamText, setStreamText] = useState('');
	const [streamReasoning, setStreamReasoning] = useState('');
	const [activities, setActivities] = useState<Activity[]>([]);
	const [pending, setPending] = useState<Pending | null>(null);
	const [running, setRunning] = useState(false);
	const [draft, setDraft] = useState('');
	const [banner, setBanner] = useState<string | null>(null);

	const sockRef = useRef<AgentSocket | null>(null);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const optsRef = useRef(sendOpts);
	optsRef.current = sendOpts;
	const onSessionRef = useRef(onSession); onSessionRef.current = onSession;
	const onDoneRef = useRef(onDone); onDoneRef.current = onDone;

	const upsert = useCallback((m: CodeMessage) => {
		setMessages(prev => {
			const others = prev.filter(x => x.id !== m.id && x.id !== '__pending__');
			return [...others, m].sort((a, b) => a.seq - b.seq);
		});
	}, []);

	const onFrame = useCallback((f: ServerFrame) => {
		// MERGE catch-up (reconnect sends only messages since our last seq) — never
		// replace, or a reconnect wipes the visible transcript.
		if (f.catch_up) {
			const cu = (f.catch_up.messages || []) as CodeMessage[];
			if (cu.length) {
				setMessages(prev => {
					const map = new Map(prev.filter(m => m.id !== '__pending__').map(m => [m.id, m] as [string, CodeMessage]));
					for (const m of cu) { map.set(m.id, m); }
					return Array.from(map.values()).sort((a, b) => a.seq - b.seq);
				});
			}
			setRunning(!!f.catch_up.running);
			return;
		}
		if ((f as any).session) { onSessionRef.current?.((f as any).session); return; }
		if (f.message) {
			const m = f.message as CodeMessage;
			if (m.role === 'assistant') { setStreamText(''); setStreamReasoning(''); }
			upsert(m);
			return;
		}
		if (f.delta) { setStreamText(t => t + f.delta); return; }
		if (f.reasoning) { setStreamReasoning(r => r + f.reasoning); return; }
		if (f.activity) {
			if (f.activity.status === 'awaiting_approval') { setPending({ callId: f.activity.callId, label: f.activity.label }); }
			else { setActivities(a => [...a.filter(x => x.callId !== f.activity!.callId), { callId: f.activity!.callId, name: f.activity!.name, label: f.activity!.label, status: f.activity!.status }]); }
			return;
		}
		if (f.tool_result) { setActivities(a => a.filter(x => x.callId !== f.tool_result!.callId)); return; }
		if (f.done) { setRunning(false); setStreamText(''); setStreamReasoning(''); setActivities([]); setPending(null); onDoneRef.current?.(); return; }
		if (f.error) { setRunning(false); setBanner(f.error.message); return; }
	}, [upsert]);

	useEffect(() => {
		let sock: AgentSocket | null = null;
		setMessages([]); setStreamText(''); setStreamReasoning(''); setActivities([]); setPending(null); setRunning(false); setBanner(null);
		(async () => {
			try {
				const hist = await codeApi.getMessages(sessionId);
				setMessages(hist.messages);
				setRunning(hist.running);
				const last = hist.messages.length ? hist.messages[hist.messages.length - 1].seq : 0;
				sock = new AgentSocket(sessionId, last);
				sockRef.current = sock;
				sock.on(onFrame);
				await sock.connect();
			} catch (e) { setBanner((e as Error).message); }
		})();
		return () => { sock?.close(); sockRef.current = null; };
	}, [sessionId, onFrame]);

	useEffect(() => { const el = bodyRef.current; if (el) { el.scrollTop = el.scrollHeight; } }, [messages, streamText, activities, pending]);

	function send() {
		const t = draft.trim();
		if (!t || running || !sockRef.current) { return; }
		setDraft(''); setBanner(null);
		setMessages(prev => [...prev, { id: '__pending__', seq: (prev[prev.length - 1]?.seq || 0) + 0.5, role: 'user', content: t, ts: Date.now() } as CodeMessage]);
		setRunning(true);
		sockRef.current.sendMessage(t, optsRef.current);
	}
	function stop() { sockRef.current?.cancel(); setRunning(false); }
	function resolvePlan(approved: boolean) { if (pending) { sockRef.current?.approvePlan(pending.callId, approved); setPending(null); } }

	return (
		<>
			{banner && <div className="cs-banner">{banner}<button onClick={() => setBanner(null)}>✕</button></div>}
			<div className="cs-body" ref={bodyRef}>
				{messages.length === 0 && !streamText && (
					<div className="cs-empty">{emptyHint || 'Начните диалог.'}</div>
				)}
				{messages.map(m => <MessageRow key={m.id} m={m} models={models} />)}
				{activities.map(a => <div key={a.callId} className="cs-activity"><span className="cs-spin" /> {a.label}…</div>)}
				{streamReasoning && (
					<details className="cs-reasoning" open><summary>Размышления</summary><pre>{streamReasoning}</pre></details>
				)}
				{streamText && (
					<div className="cs-msg assistant"><div className="cs-av a">◆</div><div className="cs-txt">{streamText}<span className="cs-caret" /></div></div>
				)}
				{pending && (
					<div className="cs-approve">
						<div style={{ fontWeight: 600, marginBottom: 6 }}>{pending.label}</div>
						<div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Агент предлагает план изменений. Одобрить?</div>
						<div style={{ display: 'flex', gap: 8 }}>
							<button className="btn" onClick={() => resolvePlan(true)}>Одобрить</button>
							<button className="btn ghost" onClick={() => resolvePlan(false)}>Отклонить</button>
						</div>
					</div>
				)}
			</div>
			<div className="cs-composer">
				<textarea value={draft} rows={1} placeholder={running ? 'Агент работает…' : 'Сообщение…'} disabled={running}
					onChange={e => setDraft(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
				{running
					? <button className="cs-send stop" onClick={stop} title="Остановить">■</button>
					: <button className="cs-send" onClick={send} title="Отправить" disabled={!draft.trim()}>↑</button>}
			</div>
		</>
	);
}

function MessageRow({ m, models }: { m: CodeMessage; models: CodeModel[] }) {
	if (m.role === 'error') { return <div className="cs-error">⚠ {m.content}</div>; }
	if (m.role === 'tool') {
		return <details className="cs-tool"><summary>🔧 {m.name?.replace(/^alaska_/, '')}</summary><pre>{m.content}</pre></details>;
	}
	const isUser = m.role === 'user';
	if (!isUser && !m.content.trim() && m.tool_calls?.length) {
		return <div className="cs-toolcall">→ вызывает {m.tool_calls.map(t => (t.function?.name || '').replace(/^alaska_/, '')).join(', ')}</div>;
	}
	return (
		<div className={'cs-msg ' + (isUser ? 'user' : 'assistant')}>
			<div className={'cs-av ' + (isUser ? 'u' : 'a')}>{isUser ? 'ВЫ' : '◆'}</div>
			<div className="cs-txt">
				{m.content}
				{!isUser && m.model && <div className="cs-meta">{models.find(x => x.id === m.model)?.label || m.model}{m.usage ? ` · ${m.usage.output} ток` : ''}</div>}
			</div>
		</div>
	);
}
