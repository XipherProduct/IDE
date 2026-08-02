import { useEffect, useState } from 'react';
import { codeApi, CodeSession, CodeModel, Executor } from '../lib/api';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { Paywall } from '../components/Paywall';

const WORKSPACES: { kind: CodeSession['workspace']['kind']; label: string; hint: string }[] = [
	{ kind: 'echo', label: 'Без проекта', hint: 'Чат с агентом и веб-инструментами. Файловые операции симулируются.' },
	{ kind: 'local', label: 'Локальный ПК', hint: 'Через демон xipher-agent — работа в проекте на вашем компьютере.' },
	{ kind: 'ssh', label: 'SSH-хост', hint: 'Удалённый сервер по SSH.' },
	{ kind: 'ide', label: 'Открытая IDE', hint: 'Работать в проекте, открытом прямо сейчас в вашей Xipher IDE.' },
];

function timeAgo(ts?: number): string {
	if (!ts) { return ''; }
	const s = Math.floor((Date.now() - ts) / 1000);
	if (s < 60) { return 'только что'; }
	if (s < 3600) { return `${Math.floor(s / 60)} мин назад`; }
	if (s < 86400) { return `${Math.floor(s / 3600)} ч назад`; }
	return `${Math.floor(s / 86400)} дн назад`;
}

export function Code() {
	const { user } = useAuth();
	const [sessions, setSessions] = useState<CodeSession[]>([]);
	const [models, setModels] = useState<CodeModel[]>([]);
	const [execs, setExecs] = useState<Executor[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	// new-session form
	const [title, setTitle] = useState('');
	const [model, setModel] = useState('');
	const [ws, setWs] = useState<CodeSession['workspace']['kind']>('echo');
	const [execId, setExecId] = useState('');

	async function load() {
		try {
			const [s, m, e] = await Promise.all([codeApi.listSessions(), codeApi.models(), codeApi.listExecutors().catch(() => ({ executors: [] }))]);
			setSessions(s.sessions);
			setModels(m.items);
			setExecs(e.executors);
			if (!model) { const def = m.items.find(x => !x.locked); if (def) { setModel(def.id); } }
		} catch (e) { setErr((e as Error).message); }
		finally { setLoading(false); }
	}
	useEffect(() => { if (user) { void load(); } else { setLoading(false); } }, [user]);

	const execsForKind = execs.filter(e => e.kind === ws);
	// auto-pick the first online executor when a real-machine kind is chosen
	useEffect(() => {
		if (ws !== 'echo') { const on = execsForKind.find(e => e.status === 'online') || execsForKind[0]; setExecId(on?.id || ''); }
	}, [ws, execs]); // eslint-disable-line react-hooks/exhaustive-deps

	async function create() {
		setCreating(true); setErr(null);
		try {
			const needsExec = ws !== 'echo';
			if (needsExec && !execId) { setErr('Сначала подключите машину на странице «Подключения».'); setCreating(false); return; }
			const r = await codeApi.createSession({ title: title.trim() || 'Новая сессия', model: model || null, workspaceKind: ws, workspaceRef: needsExec ? execId : undefined });
			navigate('/code/' + r.session.id);
		} catch (e) { setErr((e as Error).message); setCreating(false); }
	}

	async function remove(id: string, ev: React.MouseEvent) {
		ev.stopPropagation();
		if (!confirm('Удалить сессию?')) { return; }
		try { await codeApi.deleteSession(id); setSessions(s => s.filter(x => x.id !== id)); } catch { /* ignore */ }
	}

	if (!user) {
		return (
			<div>
				<h1 className="page" style={{ fontSize: 28 }}>Code</h1>
				<p className="lead">Войдите, чтобы работать с агентом из веба. <a href="#/login">Вход →</a></p>
			</div>
		);
	}
	if (user.plan === 'free') {
		return <Paywall feature="Code" desc="Автономный агент, который работает прямо в вашем проекте — читает и правит файлы, запускает команды, ищет в вебе." />;
	}

	return (
		<div className="code-page">
			<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
				<h1 className="page" style={{ fontSize: 28, margin: 0 }}>Code</h1>
				<span className="muted" style={{ fontSize: 13 }}>Пишите агенту прямо из браузера — как в IDE, без установки.</span>
			</div>

			<div className="card" style={{ padding: 18, margin: '18px 0 24px' }}>
				<div style={{ fontWeight: 600, marginBottom: 12 }}>Новая сессия</div>
				<div className="code-newgrid">
					<label className="code-field">
						<span>Название</span>
						<input value={title} placeholder="напр. Рефакторинг API" onChange={e => setTitle(e.target.value)} />
					</label>
					<label className="code-field">
						<span>Модель</span>
						<select value={model} onChange={e => setModel(e.target.value)}>
							{models.map(m => <option key={m.id} value={m.id} disabled={m.locked}>{m.label}{m.locked ? ' 🔒' : ''}</option>)}
						</select>
					</label>
				</div>
				<div className="code-wsrow">
					{WORKSPACES.map(w => (
						<button key={w.kind} type="button"
							className={'code-wscard' + (ws === w.kind ? ' active' : '')}
							onClick={() => setWs(w.kind)}>
							<b>{w.label}</b>
							<span>{w.hint}</span>
						</button>
					))}
				</div>
				{ws !== 'echo' && (
					execsForKind.length === 0 ? (
						<div style={{ marginTop: 12, fontSize: 13, color: 'var(--warn)' }}>
							Нет подключённых машин. <a href="#/executors">Подключить →</a>
						</div>
					) : (
						<label className="code-field" style={{ marginTop: 12, maxWidth: 380 }}>
							<span>Машина</span>
							<select value={execId} onChange={e => setExecId(e.target.value)}>
								{execsForKind.map(e => <option key={e.id} value={e.id} disabled={e.status !== 'online'}>{e.name} · {e.status === 'online' ? 'онлайн' : 'офлайн'}</option>)}
							</select>
						</label>
					)
				)}
				{err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{err}</div>}
				<button className="btn" style={{ marginTop: 14 }} onClick={create} disabled={creating}>
					{creating ? 'Создаю…' : 'Создать и открыть →'}
				</button>
			</div>

			<div style={{ fontWeight: 600, marginBottom: 10 }}>Сессии</div>
			{loading ? <p className="muted">Загрузка…</p>
				: sessions.length === 0 ? <p className="muted">Пока нет сессий — создайте первую выше.</p>
				: (
					<div className="code-list">
						{sessions.map(s => (
							<div key={s.id} className="card code-item" onClick={() => navigate('/code/' + s.id)}>
								<div style={{ minWidth: 0, flex: 1 }}>
									<div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
									<div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
										{modelLabel(models, s.model)} · {wsLabel(s.workspace.kind)} · {timeAgo(s.updatedAt)}
									</div>
								</div>
								<button className="code-del" title="Удалить" onClick={e => remove(s.id, e)}>✕</button>
							</div>
						))}
					</div>
				)}
		</div>
	);
}

function modelLabel(models: CodeModel[], id: string | null): string {
	if (!id) { return 'модель по умолчанию'; }
	return models.find(m => m.id === id)?.label || id;
}
function wsLabel(kind: string): string {
	return ({ echo: 'без проекта', local: 'локально', ssh: 'SSH', ide: 'IDE', none: 'без проекта' } as Record<string, string>)[kind] || kind;
}
