import { useEffect, useState } from 'react';
import { codeApi, CodeSession as Session, CodeModel } from '../lib/api';
import { AgentChat } from '../components/AgentChat';
import { navigate } from '../lib/router';

export function CodeSession({ id }: { id: string }) {
	const [session, setSession] = useState<Session | null>(null);
	const [models, setModels] = useState<CodeModel[]>([]);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const [hist, m] = await Promise.all([codeApi.getMessages(id), codeApi.models()]);
				if (!hist.session) { setNotFound(true); return; }
				setSession(hist.session);
				setModels(m.items);
			} catch (e) {
				if ((e as any).status === 404) { setNotFound(true); }
			}
		})();
	}, [id]);

	async function changeModel(modelId: string) {
		if (!session) { return; }
		setSession({ ...session, model: modelId });
		try { await codeApi.patchSession(id, { model: modelId }); } catch { /* ignore */ }
	}

	if (notFound) {
		return <div><h1 className="page" style={{ fontSize: 24 }}>Сессия не найдена</h1><p className="lead"><a href="#/code">← Все сессии</a></p></div>;
	}

	return (
		<div className="cs-wrap">
			<div className="cs-head">
				<button className="cs-back" onClick={() => navigate('/code')}>←</button>
				<div style={{ minWidth: 0, flex: 1 }}>
					<div className="cs-title" title={session?.title}>{session?.title || 'Сессия'}</div>
					<div className="muted" style={{ fontSize: 11 }}>{wsLabel(session?.workspace.kind)}</div>
				</div>
				<select className="cs-model" value={session?.model || ''} onChange={e => changeModel(e.target.value)}>
					{models.map(m => <option key={m.id} value={m.id} disabled={m.locked}>{m.label}{m.locked ? ' 🔒' : ''}</option>)}
				</select>
			</div>
			{session && (
				<AgentChat
					sessionId={id}
					models={models}
					sendOpts={{ model: session.model, agentMode: session.agentMode, permissionMode: session.permissionMode }}
					onSession={s => setSession(prev => prev ? { ...prev, title: s.title } : prev)}
					emptyHint="Начните диалог — агент может искать в вебе, читать страницы и (с проектом) работать с файлами."
				/>
			)}
		</div>
	);
}

function wsLabel(kind?: string): string {
	return ({ echo: 'без проекта', local: 'локальный ПК', ssh: 'SSH-хост', ide: 'IDE', none: 'без проекта' } as Record<string, string>)[kind || 'echo'] || (kind || '');
}
