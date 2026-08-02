import { useEffect, useState, useCallback } from 'react';
import { api, Invoice, Promo } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { Tabs } from '../components/Tabs';
import { rub, credits } from '../lib/format';

const TIERS = ['free', 'trial', 'pro', 'maxx5', 'maxx20'];
function dt(ts: number) { return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

export function Admin() {
	const { user, loading } = useAuth();
	const [tab, setTab] = useState('overview');
	const [ov, setOv] = useState<any>(null);
	const [metrics, setMetrics] = useState<any>(null);
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [promos, setPromos] = useState<{ promos: Promo[]; stats: any } | null>(null);
	const [ide, setIde] = useState<any>(null);
	const [devUser, setDevUser] = useState<Record<string, string>>({});
	const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
	const [gEmail, setGEmail] = useState(''); const [gCredits, setGCredits] = useState(0); const [gBalance, setGBalance] = useState(0); const [gPlan, setGPlan] = useState('');
	const [pCode, setPCode] = useState(''); const [pKind, setPKind] = useState('percent'); const [pValue, setPValue] = useState(20); const [pScope, setPScope] = useState('any');
	const [q, setQ] = useState('');

	const reload = useCallback(() => {
		Promise.all([api.adminOverview(), api.adminMetrics(), api.adminInvoices(), api.adminPromos()])
			.then(([o, m, inv, pr]) => { setOv(o); setMetrics(m); setInvoices(inv.invoices); setPromos(pr); })
			.catch(e => setErr(e.data?.error || e.message));
		api.adminIde().then(setIde).catch(() => setIde({ error: true })); // IDE fleet (may be unconfigured)
	}, []);
	useEffect(() => { if (user?.isAdmin) { reload(); } }, [user, reload]);

	if (loading) { return <p className="muted">Загрузка…</p>; }
	if (!user) { navigate('/login'); return null; }
	if (!user.isAdmin) { return <p className="err">Доступ только для администраторов.</p>; }

	async function run(fn: () => Promise<string>) {
		setMsg(''); setErr('');
		try { setMsg(await fn()); reload(); } catch (e: any) { setErr(e.data?.error || e.message); }
	}

	const users = (ov?.users || []).filter((u: any) => !q || u.email.toLowerCase().includes(q.toLowerCase()));

	return (
		<div>
			<span className="hero-tag">◆ админ-панель</span>
			<h1 className="page" style={{ fontSize: 30, marginBottom: 20 }}>Управление</h1>

			<Tabs active={tab} onChange={setTab} tabs={[
				{ id: 'overview', label: 'Обзор', icon: '◔' },
				{ id: 'users', label: `Пользователи ${ov ? `· ${ov.userCount}` : ''}`, icon: '☰' },
				{ id: 'billing', label: 'Платежи', icon: '₽' },
				{ id: 'promos', label: 'Промокоды', icon: '%' },
				{ id: 'grant', label: 'Начисления', icon: '+' },
				{ id: 'executors', label: `Исполнители ${ide?.stats ? `· ${ide.stats.executorsOnline}/${ide.stats.executorsTotal}` : ''}`, icon: '⚡' },
				{ id: 'sessions', label: `Сессии ${ide?.sessions ? `· ${ide.sessions.totalSessions}` : ''}`, icon: '◇' },
				{ id: 'models', label: 'Модели', icon: '⬡' },
				{ id: 'devices', label: `Устройства ${ide?.pending?.length ? `· ${ide.pending.length}` : ''}`, icon: '⎘' },
			]} />

			{err && <p className="err">{err}</p>}
			{msg && <p className="ok">{msg}</p>}
			{!metrics ? <p className="muted">Загрузка данных…</p> : (
				<>
					{tab === 'overview' && (
						<>
							<div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
								{[['MRR', rub(metrics.mrr)], ['ARR', rub(metrics.arr)], ['ARPU', rub(metrics.arpu)], ['Платных подписок', String(metrics.activePaid)],
								['Чистая выручка', rub(metrics.netRub)], ['Возвраты', rub(metrics.refundedRub)], ['Кошельки (обяз-во)', rub(metrics.walletLiabilityRub)], ['Ожидают оплаты', String(metrics.pendingInvoices ?? 0)]]
									.map(([k, v]) => <div className="stat" key={k}><div className="k">{k}</div><div className="v" style={{ fontSize: 20 }}>{v}</div></div>)}
							</div>
							<div className="section-title">// выручка по тарифам</div>
							<div className="card"><table className="table"><thead><tr><th>тариф</th><th>сумма</th></tr></thead><tbody>
								{Object.entries(metrics.byPlan || {}).map(([p, v]) => <tr key={p}><td>{p}</td><td>{rub(v as number)}</td></tr>)}
								{Object.keys(metrics.byPlan || {}).length === 0 && <tr><td colSpan={2} className="muted">пока нет</td></tr>}
							</tbody></table></div>
							<div className="section-title">// платёжный шлюз</div>
							<div className="card"><span className={'badge ' + (metrics.paymentsEnabled ? 'paid' : '')}>{metrics.paymentsEnabled ? 'Platega подключена' : 'приём оплаты не настроен'}</span></div>
							{ide && !ide.error && ide.stats && (
								<>
									<div className="section-title">// ide / web code</div>
									<div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
										{[['Исполнители онлайн', `${ide.stats.executorsOnline} / ${ide.stats.executorsTotal}`], ['Сессии Code', String(ide.stats.sessions)], ['Модели', String(ide.stats.models)], ['Фактов в памяти', String(ide.memory?.totalFacts ?? 0)]]
											.map(([k, v]) => <div className="stat" key={k}><div className="k">{k}</div><div className="v" style={{ fontSize: 20 }}>{v}</div></div>)}
									</div>
								</>
							)}
						</>
					)}

					{tab === 'users' && (
						<div className="card" style={{ overflowX: 'auto' }}>
							<input placeholder="поиск по email…" value={q} onChange={e => setQ(e.target.value)}
								style={{ width: '100%', maxWidth: 320, marginBottom: 12, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '9px 12px', color: 'var(--ink)' }} />
							<table className="table">
								<thead><tr><th>email</th><th>тариф</th><th>кошелёк</th><th>кредиты</th><th>сменить</th></tr></thead>
								<tbody>
									{users.map((u: any) => (
										<tr key={u.id}>
											<td>{u.email}{u.isAdmin && ' 👑'}</td>
											<td><span className={'badge ' + (u.plan === 'free' ? '' : u.plan === 'pro' ? 'pro' : 'paid')}>{u.plan_label}</span></td>
											<td className="muted">{rub(u.balanceRub || 0)}</td>
											<td className="muted">{credits(u.bonusCredits || 0)}</td>
											<td><select defaultValue={u.plan} onChange={e => run(async () => { await api.adminSetPlan(u.email, e.target.value); return `✓ ${u.email} → ${e.target.value}.`; })}
												style={{ background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 7, padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
												{TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
										</tr>
									))}
									{users.length === 0 && <tr><td colSpan={5} className="muted">ничего не найдено</td></tr>}
								</tbody>
							</table>
						</div>
					)}

					{tab === 'billing' && (
						<div className="card" style={{ overflowX: 'auto' }}>
							<table className="table">
								<thead><tr><th>дата</th><th>тип</th><th>сумма</th><th>метод</th><th>статус</th><th></th></tr></thead>
								<tbody>
									{invoices.slice(0, 60).map(inv => (
										<tr key={inv.id}>
											<td className="muted">{dt(inv.ts)}</td><td>{inv.kind}</td>
											<td style={{ fontVariantNumeric: 'tabular-nums' }}>{rub(inv.totalRub)}</td><td className="muted">{inv.method}</td>
											<td><span className={'badge ' + (inv.status === 'paid' ? 'paid' : '')}>{inv.status === 'refunded' ? 'возврат' : inv.status === 'paid' ? 'оплачено' : inv.status}</span></td>
											<td>{inv.status === 'paid' && inv.totalRub > 0 && <button className="btn ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => run(async () => { await api.adminRefund(inv.id); return `✓ Возврат ${rub(inv.totalRub)}.`; })}>вернуть</button>}</td>
										</tr>
									))}
									{invoices.length === 0 && <tr><td colSpan={6} className="muted">пока нет платежей</td></tr>}
								</tbody>
							</table>
						</div>
					)}

					{tab === 'promos' && (
						<>
							<div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
								<Inp label="код" value={pCode} onChange={v => setPCode(v.toUpperCase())} w={130} />
								<Sel label="тип" value={pKind} onChange={setPKind} opts={[['percent', '%'], ['fixed', '₽']]} />
								<Inp label="значение" value={String(pValue)} onChange={v => setPValue(+v)} type="number" w={90} />
								<Sel label="применять к" value={pScope} onChange={setPScope} opts={[['any', 'всё'], ['plan', 'тариф'], ['credits', 'кредиты'], ['topup', 'пополнение']]} />
								<button className="btn" onClick={() => run(async () => { const r = await api.adminCreatePromo({ code: pCode, kind: pKind, value: pValue, appliesTo: pScope }); if (!r.ok) { throw Object.assign(new Error(r.error), { data: r }); } setPCode(''); return `✓ Промокод ${pCode} создан.`; })}>Создать</button>
							</div>
							{promos && <p className="muted" style={{ marginBottom: 12 }}>всего {promos.stats.total} · активны {promos.stats.active} · активаций {promos.stats.redemptions}</p>}
							<div className="card" style={{ overflowX: 'auto' }}>
								<table className="table">
									<thead><tr><th>код</th><th>скидка</th><th>область</th><th>исп.</th><th></th></tr></thead>
									<tbody>
										{promos?.promos.map(p => (
											<tr key={p.code}>
												<td style={{ fontFamily: 'var(--font-mono)' }}>{p.code}{!p.active && <span className="muted"> · выкл</span>}</td>
												<td>{p.kind === 'percent' ? `−${p.value}%` : `−${rub(p.value)}`}</td><td className="muted">{p.appliesTo}</td>
												<td className="muted">{p.uses}{p.maxUses ? `/${p.maxUses}` : ''}</td>
												<td><button className="btn ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => run(async () => { await api.adminTogglePromo(p.code, !p.active); return `✓ ${p.code} ${!p.active ? 'вкл' : 'выкл'}.`; })}>{p.active ? 'выкл' : 'вкл'}</button></td>
											</tr>
										))}
										{promos?.promos.length === 0 && <tr><td colSpan={5} className="muted">пока нет промокодов</td></tr>}
									</tbody>
								</table>
							</div>
						</>
					)}

					{tab === 'grant' && (
						<div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
							<Inp label="email пользователя" value={gEmail} onChange={setGEmail} w={220} />
							<Inp label="кредиты" value={String(gCredits)} onChange={v => setGCredits(+v)} type="number" w={110} />
							<Inp label="₽ на кошелёк" value={String(gBalance)} onChange={v => setGBalance(+v)} type="number" w={120} />
							<Sel label="тариф (опц.)" value={gPlan} onChange={setGPlan} opts={[['', '—'], ...TIERS.map(t => [t, t] as [string, string])]} />
							<button className="btn" onClick={() => run(async () => { await api.adminGrant(gEmail, { credits: gCredits || undefined, balanceRub: gBalance || undefined, plan: gPlan || undefined }); return `✓ Начислено ${gEmail}.`; })}>Начислить</button>
						</div>
					)}

					{tab === 'executors' && (
						<div className="card" style={{ overflowX: 'auto' }}>
							{!ide ? <p className="muted">Загрузка…</p> : ide.error ? <p className="muted">IDE-бэкенд недоступен (проверьте IDE_ADMIN_TOKEN).</p> : (
								<table className="table">
									<thead><tr><th></th><th>имя</th><th>тип</th><th>пользователь</th><th>ОС</th><th>проект</th><th>активность</th><th></th></tr></thead>
									<tbody>
										{(ide.executors || []).map((e: any) => (
											<tr key={e.id}>
												<td>{e.status === 'online' ? '🟢' : '⚪'}</td>
												<td>{e.name}</td>
												<td><span className={'badge ' + (e.kind === 'ide' ? 'pro' : e.kind === 'local' ? 'paid' : '')}>{kindLabel(e.kind)}</span></td>
												<td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.userId}</td>
												<td className="muted">{e.os || '—'}</td>
												<td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.root || '—'}</td>
												<td className="muted">{ago(e.lastSeen)}</td>
												<td><button className="btn ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => run(async () => { await api.adminIdeRevokeExecutor(e.id); return `✓ ${e.name} отвязан.`; })}>отвязать</button></td>
											</tr>
										))}
										{(!ide.executors || ide.executors.length === 0) && <tr><td colSpan={8} className="muted">нет подключений</td></tr>}
									</tbody>
								</table>
							)}
						</div>
					)}

					{tab === 'sessions' && (
						<div className="card" style={{ overflowX: 'auto' }}>
							<table className="table">
								<thead><tr><th>название</th><th>пользователь</th><th>воркспейс</th><th>модель</th><th>режим</th><th>сообщ.</th><th>обновлено</th></tr></thead>
								<tbody>
									{(ide?.sessions?.recent || []).map((s: any) => (
										<tr key={s.id}>
											<td>{s.title}</td>
											<td className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.userId}</td>
											<td><span className="badge">{kindLabel(s.workspace?.kind)}</span></td>
											<td className="muted">{s.model || '—'}</td><td className="muted">{s.agentMode || 'agent'}</td>
											<td className="muted">{s.messages}</td><td className="muted">{ago(s.updatedAt)}</td>
										</tr>
									))}
									{(!ide?.sessions?.recent?.length) && <tr><td colSpan={7} className="muted">нет сессий</td></tr>}
								</tbody>
							</table>
						</div>
					)}

					{tab === 'models' && (
						<div className="card" style={{ overflowX: 'auto' }}>
							<table className="table">
								<thead><tr><th>id</th><th>название</th><th>провайдер</th><th>контекст</th><th>×кредит</th><th>тариф</th><th>reasoning</th></tr></thead>
								<tbody>
									{(ide?.models || []).map((m: any) => (
										<tr key={m.id}>
											<td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.id}</td><td>{m.label}</td>
											<td className="muted">{ctxLabel(m.ctx)}</td><td>{m.mult}×</td>
											<td><span className={'badge ' + (m.minTier === 'free' ? '' : 'pro')}>{m.minTier}</span></td>
											<td className="muted">{m.reasoning ? 'think' : '—'}</td>
										</tr>
									))}
									{(!ide?.models?.length) && <tr><td colSpan={7} className="muted">Загрузка…</td></tr>}
								</tbody>
							</table>
						</div>
					)}

					{tab === 'devices' && (
						<div className="card">
							{(ide?.pending?.length) ? ide.pending.map((p: any) => (
								<div key={p.user_code} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
									<b style={{ fontFamily: 'var(--font-mono)', fontSize: 16, letterSpacing: 2 }}>{p.user_code}</b>
									<input placeholder="userId (или owner)" value={devUser[p.user_code] || ''} onChange={e => setDevUser(d => ({ ...d, [p.user_code]: e.target.value }))}
										style={{ flex: 1, minWidth: 180, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
									<button className="btn" onClick={() => run(async () => { await api.adminIdeApprove(p.user_code, (devUser[p.user_code] || '').trim() || 'owner'); return `✓ ${p.user_code} одобрено.`; })}>одобрить</button>
								</div>
							)) : <p className="muted">нет ожидающих устройств</p>}
						</div>
					)}
				</>
			)}
		</div>
	);
}

function ago(ts?: number): string {
	if (!ts) { return '—'; }
	const s = (Date.now() - ts) / 1000;
	if (s < 60) { return 'только что'; }
	if (s < 3600) { return `${Math.floor(s / 60)} мин`; }
	if (s < 86400) { return `${Math.floor(s / 3600)} ч`; }
	return `${Math.floor(s / 86400)} дн`;
}
function kindLabel(k?: string): string {
	return ({ echo: 'веб', none: 'веб', local: 'ПК', ssh: 'SSH', ide: 'IDE' } as Record<string, string>)[k || ''] || k || 'веб';
}
function ctxLabel(ctx?: number): string {
	const c = ctx || 0;
	if (c >= 1000000) { return `${(c / 1000000).toFixed(c % 1000000 ? 1 : 0)}M`; }
	return `${Math.round(c / 1000)}K`;
}

function Inp({ label, value, onChange, type = 'text', w = 140 }: { label: string; value: string; onChange: (v: string) => void; type?: string; w?: number }) {
	return (
		<label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-2)' }}>
			{label}
			<input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ width: w, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
		</label>
	);
}
function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
	return (
		<label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-2)' }}>
			{label}
			<select value={value} onChange={e => onChange(e.target.value)} style={{ background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
				{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
			</select>
		</label>
	);
}
