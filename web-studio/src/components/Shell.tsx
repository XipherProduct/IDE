import { ReactNode, useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';

const Mark = () => (
	<svg viewBox="0 0 26 26" fill="none">
		<path d="M13 1 L25 13 L13 25 L1 13 Z" stroke="var(--ice)" strokeWidth="1.2" strokeOpacity=".4" />
		<path d="M13 4 L22 13 L13 22 L4 13 Z" fill="var(--ice)" fillOpacity=".2" />
		<path d="M13 7 L19 13 L13 19 L7 13 Z" fill="var(--ice)" />
	</svg>
);

interface FileItem { path: string; file: string; desc: string; auth?: boolean; admin?: boolean; }

export function Shell({ path, children }: { path: string; children: ReactNode }) {
	const { user } = useAuth();
	const [chat, setChat] = useState<{ role: 'a' | 'u'; text: string }[]>([
		{ role: 'a', text: 'Привет! Это демо-чат сайта. Спросите про тарифы, модели или установку — отвечу коротко.' },
	]);
	const [draft, setDraft] = useState('');
	const [navOpen, setNavOpen] = useState(false);

	const files: FileItem[] = [
		{ path: '/', file: 'home.tsx', desc: 'Главная' },
		{ path: '/pricing', file: 'pricing.tsx', desc: 'Тарифы' },
		{ path: '/download', file: 'download.tsx', desc: 'Скачать' },
		...(user ? [{ path: '/code', file: 'code.tsx', desc: 'Code — агент из веба', auth: true } as FileItem] : []),
		...(user ? [{ path: '/chat', file: 'chat.tsx', desc: 'Чат + память', auth: true } as FileItem] : []),
		...(user ? [{ path: '/executors', file: 'executors.tsx', desc: 'Подключения (ПК/SSH)', auth: true } as FileItem] : []),
		{ path: '/dashboard', file: 'dashboard.tsx', desc: 'Личный кабинет', auth: true },
		...(user ? [{ path: '/billing', file: 'billing.tsx', desc: 'Биллинг', auth: true } as FileItem] : []),
		...(user?.isAdmin ? [{ path: '/admin', file: 'admin.ts', desc: 'Админ', admin: true } as FileItem] : []),
		...(user ? [] : [{ path: '/login', file: 'login.tsx', desc: 'Вход' } as FileItem]),
	];
	const active = files.find(f => f.path === path) || files.find(f => path.startsWith(f.path) && f.path !== '/') || files[0];

	function send() {
		const t = draft.trim();
		if (!t) { return; }
		setChat(c => [...c, { role: 'u', text: t }]);
		setDraft('');
		setTimeout(() => {
			const reply = /цен|тариф|pro|max|сколько|руб/i.test(t)
				? 'Pro — 999 ₽/мес, Max ×5 — 4245 ₽ (−15%), Max ×20 — 15984 ₽ (−20%). Полные лимиты на странице «Тарифы».'
				: /модел|opus|claude|deepseek/i.test(t)
				? 'Доступны Claude Opus 4.8/4.7, DeepSeek, Qwen, GLM и другие — через единый шлюз.'
				: /установ|скача|download/i.test(t)
				? 'Xipher — форк VS Code: один файл, без прав администратора. Скачать под Windows и Linux — на странице «Скачать».'
				: 'В реальной IDE агент видит весь проект. Здесь — короткое демо. Спросите про тарифы или модели.';
			setChat(c => [...c, { role: 'a', text: reply }]);
		}, 350);
	}

	return (
		<div className="studio">
			<div className="titlebar">
				<button className="nav-toggle" aria-label="Меню" onClick={() => setNavOpen(v => !v)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg></button><span className="brand-pill" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}><Mark /> Xipher IDE</span>
				<div className="dots"><i /><i /><i /></div>
				<div className="crumb"><span className="slash">~/xipher</span><span className="slash">/</span><b>{active.file}</b></div>
				<div className="spacer" />
				<div className="pathbar">
					<span style={{ color: 'var(--mute)' }}>›</span>
					<input
						placeholder="перейти… (напр. /pricing)"
						onKeyDown={e => { if (e.key === 'Enter') { navigate((e.target as HTMLInputElement).value.trim() || '/'); (e.target as HTMLInputElement).value = ''; } }}
					/>
					<span className="kbd">⌘P</span>
				</div>
			</div>

			<div className="panes">
				<div className={'nav-backdrop' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)} />
				<aside className={'tree-pane' + (navOpen ? ' open' : '')}>
					<div className="head"><span>Обозреватель</span></div>
					<ul className="tree">
						{files.map(f => (
							<li key={f.path} className={f === active ? 'active' : ''} onClick={() => { navigate(f.path); setNavOpen(false); }}>
								<span className="fico">TSX</span>{f.file}
							</li>
						))}
					</ul>
					<div className="tree-foot">
						<div className="row"><span>аккаунт</span><b>{user ? user.plan_label : 'гость'}</b></div>
						<div className="row"><span>версия</span><b>v0.42.1</b></div>
						<div className="row"><span>ветка</span><b>main</b></div>
					</div>
				</aside>

				<main className="editor-pane">
					<div className="tab-bar"><div className="tab active">{active.file}</div></div>
					<div className="editor-meta">
						<div className="left"><span className="ice">●</span>&nbsp;{active.desc}</div>
						<div className="right" style={{ display: 'flex', gap: 14 }}><span>UTF-8</span><span>TSX</span></div>
					</div>
					<div className="editor-scroll">
						<div className="editor-stage">{children}</div>
					</div>
				</main>

				<aside className="chat-pane">
					<div className="chead">
						<div><span className="dot" />Чат сайта</div>
						<span className="model-pill">demo</span>
					</div>
					<div className="cnotice">Демо-чат. Прикреплять файлы нельзя — в реальной IDE агент видит весь проект.</div>
					<div className="cbody">
						{chat.map((m, i) => (
							<div className={'cmsg ' + m.role} key={i}>
								<div className="av">{m.role === 'a' ? '~' : 'ВЫ'}</div>
								<div className="txt">{m.text}</div>
							</div>
						))}
					</div>
					<div className="cinput">
						<div className="box">
							<textarea rows={1} value={draft} placeholder="спросите про тарифы, модели…"
								onChange={e => setDraft(e.target.value)}
								onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
							<button className="send" onClick={send}>↵</button>
						</div>
					</div>
				</aside>
			</div>

			<div className="studio-status">
				<div className="l"><span className="ice">● xipher подключён</span><span>main</span><span>0 ошибок</span></div>
				<div className="r"><span className="aur">телеметрия: локально</span><span>UTF-8</span><span>TypeScript 5.6</span></div>
			</div>
		</div>
	);
}
