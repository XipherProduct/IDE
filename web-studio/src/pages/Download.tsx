import { useEffect, useMemo, useState } from 'react';
import { api, DownloadItem, DownloadManifest } from '../lib/api';

type OS = 'windows' | 'linux' | 'mac' | 'other';

function detectOS(): OS {
	const s = (navigator.userAgent + ' ' + (navigator.platform || '')).toLowerCase();
	if (/windows|win32|win64/.test(s)) { return 'windows'; }
	if (/mac|iphone|ipad/.test(s)) { return 'mac'; }
	if (/linux|x11|android/.test(s)) { return 'linux'; }
	return 'other';
}

const OS_ICON: Record<string, JSX.Element> = {
	windows: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.4 10.3 4.4v7H3V5.4Zm0 13.2 7.3 1v-7H3v6ZM11.2 4.3 21 3v8.4h-9.8v-7Zm0 15.4L21 21v-8.4h-9.8v7Z"/></svg>,
	linux: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-2 0-3.2 1.8-3.2 4 0 1.3.2 2.3.2 3.2 0 1-1.2 2.2-2 3.6-.9 1.5-1.8 3-1.8 4.6 0 .8.4 1.3 1 1.5.3 1 .9 1.5 1.8 1.5.6 0 1-.2 1.4-.5.5.3 1.1.5 1.8.5.9 0 1.6-.2 2.2-.5.4.3.9.5 1.5.5.9 0 1.5-.5 1.7-1.4.7-.2 1.2-.7 1.2-1.6 0-1.6-1-3.1-1.9-4.6-.8-1.4-2-2.6-2-3.6 0-.9.2-1.9.2-3.2 0-2.2-1.2-4-3.1-4Zm-1.2 5.1c.3 0 .5.3.5.7s-.2.7-.5.7-.5-.3-.5-.7.2-.7.5-.7Zm2.4 0c.3 0 .5.3.5.7s-.2.7-.5.7-.5-.3-.5-.7.2-.7.5-.7Z"/></svg>,
};

function Row({ it }: { it: DownloadItem }) {
	return (
		<div className="card dl-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', marginBottom: 12 }}>
			<div className="dl-os" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 10, background: 'var(--panel-2, rgba(255,255,255,.04))', color: 'var(--ice)', flexShrink: 0 }}>
				{OS_ICON[it.os]}
			</div>
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					<b style={{ fontSize: 15 }}>{it.label}</b>
					<span className="logo-chip" style={{ padding: '1px 8px', fontSize: 11 }}>{it.kind}</span>
					{it.recommended && <span className="save" style={{ position: 'static', fontSize: 11 }}>рекомендуется</span>}
				</div>
				<p className="muted" style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5 }}>{it.hint}</p>
			</div>
			<div style={{ textAlign: 'right', flexShrink: 0 }}>
				{it.available && it.url ? (
					<>
						<a className={'btn' + (it.recommended ? '' : ' ghost')} href={it.url} download>↓ Скачать</a>
						<div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{it.sizeh}</div>
					</>
				) : (
					<span className="btn ghost" style={{ opacity: .5, pointerEvents: 'none' }}>скоро</span>
				)}
			</div>
		</div>
	);
}

export function Download() {
	const [mf, setMf] = useState<DownloadManifest | null>(null);
	const [err, setErr] = useState(false);
	const os = useMemo(detectOS, []);

	useEffect(() => { api.downloads().then(setMf).catch(() => setErr(true)); }, []);

	const items = mf?.items || [];
	// Primary = recommended build for the detected OS, else first available for it, else first overall.
	const primary =
		items.find(i => i.os === os && i.recommended && i.available) ||
		items.find(i => i.os === os && i.available) ||
		items.find(i => i.available) || null;
	const rest = items.filter(i => i !== primary);

	return (
		<div>
			<span className="hero-tag">◆ загрузка{mf ? ` · v${mf.version}` : ''}</span>
			<h1 className="page">Скачать <em>Xipher&nbsp;IDE</em></h1>
			<p className="lead">
				Форк VS Code со встроенным AI-агентом. Один файл, без прав администратора.
				После установки войдите через своё устройство — кабинет свяжется с редактором.
			</p>

			{err && <div className="card" style={{ padding: 18 }}><p className="muted" style={{ margin: 0 }}>Не удалось получить список сборок. Обновите страницу.</p></div>}

			{!mf && !err && <div className="card" style={{ padding: 18 }}><p className="muted" style={{ margin: 0 }}>Загрузка…</p></div>}

			{/* primary CTA for the detected OS */}
			{primary && (
				<div className="card" style={{ marginTop: 22, padding: 26, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, oklch(0.83 0.10 220 / .14), transparent 70%), var(--panel)' }}>
					<div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
						{os === 'windows' ? 'Определена Windows' : os === 'linux' ? 'Определён Linux' : os === 'mac' ? 'На macOS пока нет сборки — выберите вариант ниже' : 'Выберите вашу платформу'}
					</div>
					<h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{primary.label}</h2>
					<p className="muted" style={{ margin: '0 auto 16px', maxWidth: '42ch', fontSize: 13.5 }}>{primary.hint}</p>
					<a className="btn" style={{ fontSize: 15, padding: '11px 24px' }} href={primary.url!} download>↓ Скачать · {primary.sizeh}</a>
				</div>
			)}

			{/* Linux: one-command install as a real app (chmod + menu entry) */}
			<div className="card" style={{ marginTop: 14, padding: 18 }}>
				<h3 style={{ margin: '0 0 6px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{OS_ICON.linux} Linux — установить как приложение</h3>
				<p className="muted" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.55 }}>
					Одна команда: скачает, сделает исполняемым (то, что теряется при обычном скачивании) и добавит «Xipher IDE» в меню приложений с иконкой — запускается как обычная программа.
				</p>
				<CopyCmd cmd="curl -fsSL https://ide.xipher.pro/install.sh | bash" />
			</div>

			{/* all builds */}
			<div className="section-title">// все сборки</div>
			{rest.map(it => <Row it={it} key={it.id} />)}

			{/* install instructions */}
			<div className="section-title">// установка</div>
			<div className="grid2">
				<div className="card">
					<h3 style={{ margin: '0 0 8px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{OS_ICON.windows} Windows</h3>
					<ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13.5 }}>
						<li><b>Установщик:</b> запустите <code>XipherIDE-Setup-x64.exe</code> — прав администратора не нужно.</li>
						<li><b>Portable:</b> распакуйте .zip и запустите <code>Xipher IDE.exe</code> из папки.</li>
						<li>SmartScreen может предупредить о неизвестном издателе — «Подробнее» → «Выполнить в любом случае».</li>
					</ol>
				</div>
				<div className="card">
					<h3 style={{ margin: '0 0 8px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{OS_ICON.linux} Linux</h3>
					<ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13.5 }}>
						<li><b>Проще всего</b> — команда выше: сама сделает <code>chmod +x</code> и добавит в меню.</li>
						<li><b>Вручную:</b> <code>chmod +x Xipher_IDE-x86_64.AppImage</code></li>
						<li>Запустите: <code>./Xipher_IDE-x86_64.AppImage</code></li>
						<li>Если окно не стартует — добавьте <code>--no-sandbox</code>.</li>
					</ol>
				</div>
			</div>

			<p className="muted" style={{ marginTop: 22, fontSize: 12.5 }}>
				Системные требования: Windows 10/11 x64 или Linux x86-64. macOS-сборка появится позже.
				Вход в IDE — через ваш аккаунт, тот же, что и на сайте.
			</p>
		</div>
	);
}

function CopyCmd({ cmd }: { cmd: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="ex-cmd" onClick={() => { navigator.clipboard?.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); }} title="Скопировать">
			<code>{cmd}</code>
			<span className="ex-copy">{copied ? '✓ скопировано' : 'копировать'}</span>
		</div>
	);
}
