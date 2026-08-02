import { useEffect, useState, useCallback } from 'react';
import { codeApi, Executor, PairInfo } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Paywall } from '../components/Paywall';

export function Executors() {
	const { user } = useAuth();
	const [list, setList] = useState<Executor[]>([]);
	const [pair, setPair] = useState<PairInfo | null>(null);
	const [copied, setCopied] = useState(false);

	const load = useCallback(async () => {
		try { setList((await codeApi.listExecutors()).executors); } catch { /* ignore */ }
	}, []);
	useEffect(() => { if (user) { void load(); } }, [user, load]);
	// poll while a pairing is in progress so the daemon appears as it connects
	useEffect(() => { if (!pair) { return; } const t = setInterval(load, 2000); return () => clearInterval(t); }, [pair, load]);

	async function startPair(kind: 'local' | 'ssh') {
		try { setPair(await codeApi.pairInit(kind)); } catch { /* ignore */ }
	}
	async function revoke(id: string) {
		if (!confirm('Отвязать это подключение? Сессии, привязанные к нему, перестанут работать.')) { return; }
		try { await codeApi.revokeExecutor(id); void load(); } catch { /* ignore */ }
	}
	function copy(text: string) { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }

	if (!user) {
		return <div><h1 className="page" style={{ fontSize: 28 }}>Подключения</h1><p className="lead">Войдите. <a href="#/login">Вход →</a></p></div>;
	}
	if (user.plan === 'free') {
		return <Paywall feature="Подключения" desc="Подключите свой ПК, удалённый сервер по SSH или открытую IDE, чтобы агент работал в реальном проекте." />;
	}

	return (
		<div className="code-page">
			<h1 className="page" style={{ fontSize: 28, margin: 0 }}>Подключения</h1>
			<p className="muted" style={{ fontSize: 13, margin: '6px 0 18px', maxWidth: 640, lineHeight: 1.6 }}>
				Чтобы веб-агент работал в реальном проекте — читал и правил файлы, запускал команды.
			</p>

			<div className="card" style={{ padding: 16, marginBottom: 18, borderColor: 'var(--ice-2)' }}>
				<div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
					<span className="ex-dot online" />Xipher IDE — подключается сама
				</div>
				<p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
					Ничего запускать не нужно. Откройте проект в <b>Xipher IDE</b> (версия 1.121+) и войдите в аккаунт — IDE появится ниже как «онлайн». Тогда в <a href="#/code">Code</a> выберите воркспейс «Открытая IDE» и работайте с проектом прямо из браузера — как в Claude. Обновите IDE до 1.121, если её ещё нет.
				</p>
			</div>

			<div className="card" style={{ padding: 18, marginBottom: 22 }}>
				<div style={{ fontWeight: 600, marginBottom: 8 }}>Проект без IDE (демон)</div>
				{!pair ? (
					<>
						<p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.6 }}>
							Только если IDE не открыта. Нужен Node.js 18+. Демон подключается исходящим соединением к Xipher — ваши SSH-ключи и пароли на сервер Xipher <b>не передаются</b>.
						</p>
						<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
							<button className="btn" onClick={() => startPair('local')}>Локальный ПК</button>
							<button className="btn ghost" onClick={() => startPair('ssh')}>Удалённый сервер (SSH)</button>
						</div>
					</>
				) : (
					<>
						<div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
							{pair.kind === 'ssh' ? '1. Зайдите на удалённый сервер по SSH, перейдите в папку проекта и выполните:' : '1. Откройте терминал в корне вашего проекта и выполните:'}
						</div>
						<div className="ex-cmd" onClick={() => copy(pair.command)}>
							<code>{pair.command}</code>
							<span className="ex-copy">{copied ? '✓ скопировано' : 'копировать'}</span>
						</div>
						<div className="muted" style={{ fontSize: 12, margin: '12px 0 4px' }}>2. Затем запустите демон (оставьте работать):</div>
						<div className="ex-cmd" onClick={() => copy(pair.runCommand || 'npx -y https://ide.xipher.pro/xipher-agent.tgz')}><code>{pair.runCommand || 'npx -y https://ide.xipher.pro/xipher-agent.tgz'}</code><span className="ex-copy">копировать</span></div>
						<div style={{ marginTop: 12, fontSize: 12, color: 'var(--mute)' }}>Код действует ~10 минут. Как только демон подключится, он появится ниже.</div>
						<button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setPair(null)}>Готово</button>
					</>
				)}
			</div>

			<div style={{ fontWeight: 600, marginBottom: 10 }}>Подключённые машины</div>
			{list.length === 0 ? <p className="muted">Пока нет подключений.</p> : (
				<div className="code-list">
					{list.map(e => (
						<div key={e.id} className="card code-item" style={{ cursor: 'default' }}>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
									<span className={'ex-dot ' + e.status} />{e.name}
									<span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{e.status === 'online' ? 'онлайн' : 'офлайн'}</span>
								</div>
								<div className="muted" style={{ fontSize: 12, marginTop: 3, fontFamily: 'var(--font-mono)' }}>{e.os} · {e.root}</div>
							</div>
							<button className="code-del" title="Отвязать" onClick={() => revoke(e.id)}>✕</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
