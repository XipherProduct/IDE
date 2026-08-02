import { useEffect, useState } from 'react';
import { codeApi, CodeSession, CodeModel, MemoryFact } from '../lib/api';
import { AgentChat } from '../components/AgentChat';
import { useAuth } from '../lib/auth';

// Regular (no-workspace) chat with persistent per-user memory. The agent has no
// file tools here — just conversation, plus the facts it remembers about you,
// injected into every turn.
export function Chat() {
	const { user } = useAuth();
	const [chats, setChats] = useState<CodeSession[]>([]);
	const [currentId, setCurrentId] = useState<string>('');
	const [models, setModels] = useState<CodeModel[]>([]);
	const [model, setModel] = useState('');
	const [facts, setFacts] = useState<MemoryFact[]>([]);
	const [newFact, setNewFact] = useState('');
	const [loading, setLoading] = useState(true);

	async function loadMemory() { try { setFacts((await codeApi.getMemory()).facts); } catch { /* ignore */ } }

	useEffect(() => {
		if (!user) { setLoading(false); return; }
		(async () => {
			try {
				const [s, m] = await Promise.all([codeApi.listSessions(), codeApi.models()]);
				setModels(m.items);
				const def = m.items.find(x => !x.locked)?.id || '';
				setModel(def);
				const existing = s.sessions.filter(x => x.agentMode === 'chat');
				setChats(existing);
				if (existing.length) { setCurrentId(existing[0].id); }
				else { const r = await codeApi.createSession({ title: 'Новый чат', agentMode: 'chat', workspaceKind: 'none', model: def }); setChats([r.session]); setCurrentId(r.session.id); }
				await loadMemory();
			} finally { setLoading(false); }
		})();
	}, [user]);

	async function newChat() {
		const r = await codeApi.createSession({ title: 'Новый чат', agentMode: 'chat', workspaceKind: 'none', model });
		setChats(c => [r.session, ...c]); setCurrentId(r.session.id);
	}
	async function addFact() {
		const t = newFact.trim(); if (!t) { return; }
		setNewFact('');
		try { const r = await codeApi.addMemory(t); setFacts(f => [...f, r.fact]); } catch { /* ignore */ }
	}
	async function delFact(id: string) {
		try { await codeApi.deleteMemory(id); setFacts(f => f.filter(x => x.id !== id)); } catch { /* ignore */ }
	}

	if (!user) { return <div><h1 className="page" style={{ fontSize: 28 }}>Чат</h1><p className="lead">Войдите. <a href="#/login">Вход →</a></p></div>; }
	if (loading) { return <div><h1 className="page" style={{ fontSize: 28 }}>Чат</h1><p className="muted">Загрузка…</p></div>; }

	const curChat = chats.find(c => c.id === currentId);
	const curTitle = (curChat?.title && !/^новый чат$/i.test(curChat.title)) ? curChat.title : 'Чат с ассистентом';

	return (
		<div className="chat-layout">
			<div className="cs-wrap" style={{ flex: 1, minWidth: 0 }}>
				<div className="cs-head">
					<div style={{ minWidth: 0, flex: 1 }}>
						<div className="cs-title" title={curTitle}>{curTitle}</div>
						<div className="muted" style={{ fontSize: 11 }}>помнит факты о вас · без доступа к файлам</div>
					</div>
					<select className="cs-model" value={model} onChange={e => setModel(e.target.value)}>
						{models.map(m => <option key={m.id} value={m.id} disabled={m.locked}>{m.label}{m.locked ? ' 🔒' : ''}</option>)}
					</select>
					<button className="cs-back" title="Новый чат" onClick={newChat} style={{ width: 'auto', padding: '0 12px' }}>+ чат</button>
				</div>
				{currentId && <AgentChat sessionId={currentId} models={models} sendOpts={{ model, agentMode: 'chat' }}
					onSession={s => setChats(cs => cs.map(c => c.id === s.id ? { ...c, title: s.title } : c))}
					emptyHint="Обычный чат. Расскажите о себе — важное я запомню (см. панель «Память»)." />}
			</div>

			<aside className="mem-panel">
				<div style={{ fontWeight: 600, marginBottom: 4 }}>Память</div>
				<div className="muted" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>Факты о вас, которые ассистент учитывает в каждом диалоге.</div>
				<div className="mem-add">
					<input value={newFact} placeholder="напр. Я пишу на Go и живу в Москве"
						onChange={e => setNewFact(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addFact(); } }} />
					<button onClick={addFact} disabled={!newFact.trim()}>+</button>
				</div>
				{facts.length === 0 ? <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Пока пусто.</p> : (
					<ul className="mem-list">
						{facts.map(f => (
							<li key={f.id}><span>{f.text}</span><button title="Забыть" onClick={() => delFact(f.id)}>✕</button></li>
						))}
					</ul>
				)}
				{chats.length > 1 && (
					<>
						<div style={{ fontWeight: 600, margin: '20px 0 8px' }}>Прошлые чаты</div>
						<ul className="mem-chats">
							{chats.map(c => <li key={c.id} className={c.id === currentId ? 'active' : ''} onClick={() => setCurrentId(c.id)}>{c.title}</li>)}
						</ul>
					</>
				)}
			</aside>
		</div>
	);
}
