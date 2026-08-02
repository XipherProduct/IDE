import { useEffect, useState, useCallback, Fragment } from 'react';
import { api, BillingCatalog, Invoice, LedgerEntry } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { Tabs } from '../components/Tabs';
import { rub, credits, date } from '../lib/format';
import { handlePurchase, resolvePendingReturn } from '../lib/pay';

function dt(ts: number) { return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
const KIND: Record<string, string> = { plan: 'Тариф', topup: 'Пополнение', credits: 'Кредиты', renewal: 'Автопродление', trial: 'Пробный', referral_trial: 'Реф-триал' };

export function Billing() {
	const { user, usage, loading, refresh } = useAuth();
	const [tab, setTab] = useState('wallet');
	const [cat, setCat] = useState<BillingCatalog | null>(null);
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [ledger, setLedger] = useState<LedgerEntry[]>([]);
	const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
	const [topAmt, setTopAmt] = useState(1000); const [promo, setPromo] = useState(''); const [open, setOpen] = useState<string | null>(null);

	const reload = useCallback(async () => {
		try { const [c, inv] = await Promise.all([api.billingCatalog(), api.invoices()]); setCat(c); setInvoices(inv.invoices); setLedger(inv.ledger); } catch { /* */ }
	}, []);
	useEffect(() => { if (user) { void reload(); } }, [user, reload]);
	useEffect(() => {
		void resolvePendingReturn().then(s => {
			if (s === 'ok') { setMsg('✓ Оплата прошла — зачислено.'); void refresh(); void reload(); }
			else if (s === 'pending') { setMsg('Платёж обрабатывается — обновите через минуту.'); }
			else if (s === 'failed') { setMsg('Оплата не завершена.'); }
		});
	}, [refresh, reload]);

	if (loading) { return <p className="muted">Загрузка…</p>; }
	if (!user) { navigate('/login'); return null; }

	async function act(key: string, fn: () => Promise<string>) {
		setBusy(key); setMsg('');
		try { setMsg(await fn()); await refresh(); await reload(); }
		catch (e: any) { setMsg('Ошибка: ' + (e.data?.error || e.message)); }
		finally { setBusy(''); }
	}
	const paid = user.plan !== 'free';
	const noPay = cat?.paymentsEnabled === false;

	const promoField = (
		<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
			<input placeholder="ПРОМОКОД" value={promo} onChange={e => setPromo(e.target.value.toUpperCase())}
				style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '9px 12px', color: 'var(--ink)', fontFamily: 'var(--font-mono)', minWidth: 150 }} />
			<span className="muted" style={{ fontSize: 12 }}>применится при оплате</span>
		</div>
	);

	return (
		<div>
			<span className="hero-tag">◆ биллинг</span>
			<h1 className="page" style={{ fontSize: 30, marginBottom: 6 }}>Кошелёк и платежи</h1>
			<p className="muted" style={{ margin: '0 0 20px' }}>Баланс: <b style={{ color: 'var(--ink)' }}>{rub(user.balanceRub)}</b> · бонус-кредиты: {credits(user.bonusCredits)} · тариф: <b style={{ color: 'var(--ice)' }}>{user.plan_label}</b></p>

			<Tabs active={tab} onChange={setTab} tabs={[
				{ id: 'wallet', label: 'Кошелёк', icon: '◈' },
				{ id: 'subscription', label: 'Подписка', icon: '↻' },
				{ id: 'credits', label: 'Пакеты кредитов', icon: '＋' },
				{ id: 'history', label: 'История', icon: '≡' },
			]} />

			{msg && <p className={msg.startsWith('✓') ? 'ok' : 'err'}>{msg}</p>}
			{noPay && <p className="muted" style={{ fontSize: 12 }}>Приём оплаты картой сейчас не настроен — доступна оплата с кошелька.</p>}

			{tab === 'wallet' && (
				<div className="card">
					<div className="k" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.08em' }}>пополнить кошелёк</div>
					<div style={{ fontSize: 30, fontWeight: 700, margin: '6px 0 2px' }}>{rub(user.balanceRub)}</div>
					<div className="muted" style={{ fontSize: 12 }}>заработано с рефералов: {rub(user.referralEarningsRub)}</div>
					<div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
						{cat?.topupPresets.map(a => (
							<button key={a} className="btn ghost" style={{ padding: '7px 12px', borderColor: topAmt === a ? 'var(--ice)' : undefined }} onClick={() => setTopAmt(a)}>{rub(a)}</button>
						))}
						<input type="number" value={topAmt} min={cat?.topupBounds.min} max={cat?.topupBounds.max} onChange={e => setTopAmt(+e.target.value)}
							style={{ width: 110, background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '7px 10px', color: 'var(--ink)' }} />
					</div>
					{promoField}
					<button className="btn block" style={{ marginTop: 14 }} disabled={busy === 'topup' || noPay}
						onClick={() => act('topup', async () => { const r = await api.topup(topAmt, promo || undefined); setPromo(''); return handlePurchase(r, rr => `✓ Кошелёк пополнен на ${rub(rr.credited!)}.`); })}>
						{busy === 'topup' ? '…' : `Пополнить на ${rub(topAmt)}`}
					</button>
				</div>
			)}

			{tab === 'subscription' && (
				<div className="card">
					<div className="k" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.08em' }}>текущая подписка</div>
					<div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ice)', margin: '8px 0 2px' }}>{user.plan_label}</div>
					{paid ? <div className="muted">{user.autoRenew ? 'автопродление включено' : 'автопродление выключено'} · действует до {date(user.planExpiresAt)}</div>
						: <div className="muted">бесплатный тариф — дешёвые модели</div>}
					{usage && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>лимит недели: {credits(usage.creditsWeek_used)} / {credits(usage.creditsWeek_effective_limit ?? usage.creditsWeek_limit)} кредитов</div>}
					<div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<button className="btn" onClick={() => navigate('/pricing')}>{paid ? 'Сменить тариф →' : 'Оформить тариф →'}</button>
						{paid && <button className="btn ghost" disabled={busy === 'ar'} onClick={() => act('ar', async () => { const r = await api.autoRenew(!user.autoRenew); return `✓ Автопродление ${r.autoRenew ? 'включено' : 'выключено'}.`; })}>{user.autoRenew ? 'Выкл. автопродление' : 'Вкл. автопродление'}</button>}
						{paid && user.autoRenew && <button className="btn ghost" disabled={busy === 'cancel'} onClick={() => act('cancel', async () => { const r = await api.cancelSub(); return `✓ Подписка отменена — активна до ${date(r.endsAt)}.`; })}>Отменить</button>}
					</div>
				</div>
			)}

			{tab === 'credits' && (
				<>
					{promoField}
					<div className="price-grid" style={{ marginTop: 14 }}>
						{cat?.creditPacks.map(p => (
							<div className="price-card" key={p.id}>
								<span className="tier">+{credits(p.credits)} кредитов</span>
								<h3>{p.label}</h3>
								<div className="amt">{rub(p.priceRub)}</div>
								<div className="per">{p.perCredit} ₽ / кредит</div>
								<div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
									<button className="btn block" disabled={busy === 'pk' + p.id || noPay} onClick={() => act('pk' + p.id, async () => { const r = await api.buyCredits(p.id, { promoCode: promo || undefined }); setPromo(''); return handlePurchase(r, () => `✓ +${credits(p.credits)} кредитов.`); })}>картой</button>
									<button className="btn ghost" style={{ padding: '11px 12px' }} disabled={busy === 'pb' + p.id || user.balanceRub < p.priceRub} onClick={() => act('pb' + p.id, async () => { const r = await api.buyCredits(p.id, { promoCode: promo || undefined, method: 'balance' }); setPromo(''); return handlePurchase(r, () => `✓ +${credits(p.credits)} кредитов с кошелька.`); })}>с кошелька</button>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{tab === 'history' && (
				<>
					<div className="card" style={{ overflowX: 'auto' }}>
						<table className="table">
							<thead><tr><th>дата</th><th>тип</th><th>метод</th><th>сумма</th><th>статус</th><th></th></tr></thead>
							<tbody>
								{invoices.length === 0 && <tr><td colSpan={6} className="muted">пока нет платежей</td></tr>}
								{invoices.map(inv => (
									<Fragment key={inv.id}>
										<tr>
											<td className="muted">{dt(inv.ts)}</td><td>{KIND[inv.kind] || inv.kind}</td>
											<td className="muted">{inv.method === 'balance' ? 'кошелёк' : inv.method === 'card' ? 'карта' : inv.method}</td>
											<td style={{ fontVariantNumeric: 'tabular-nums' }}>{rub(inv.totalRub)}</td>
											<td><span className={'badge ' + (inv.status === 'paid' ? 'paid' : '')}>{inv.status === 'refunded' ? 'возврат' : inv.status === 'paid' ? 'оплачено' : inv.status === 'pending' ? 'ожидает' : inv.status}</span></td>
											<td><button className="btn ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setOpen(open === inv.id ? null : inv.id)}>{open === inv.id ? '▲' : 'чек'}</button></td>
										</tr>
										{open === inv.id && (
											<tr><td colSpan={6} style={{ background: 'var(--bg-2)' }}>
												<div style={{ padding: '6px 4px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
													{inv.items.map((it, i) => (
														<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: it.amountRub < 0 ? 'var(--aurora)' : 'var(--ink-2)' }}><span>{it.label}</span><span>{it.amountRub < 0 ? '−' : ''}{rub(Math.abs(it.amountRub))}</span></div>
													))}
													<div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 4, borderTop: '1px solid var(--line)', color: 'var(--ink)' }}><b>Итого</b><b>{rub(inv.totalRub)}</b></div>
													<div className="muted" style={{ marginTop: 6, fontSize: 11 }}>чек №{inv.id}</div>
												</div>
											</td></tr>
										)}
									</Fragment>
								))}
							</tbody>
						</table>
					</div>
					{ledger.length > 0 && (
						<>
							<div className="section-title">// движение по кошельку</div>
							<div className="card" style={{ overflowX: 'auto' }}>
								<table className="table">
									<thead><tr><th>дата</th><th>операция</th><th>сумма</th><th>баланс</th></tr></thead>
									<tbody>
										{ledger.map(l => (
											<tr key={l.id}>
												<td className="muted">{dt(l.ts)}</td><td>{l.reason}</td>
												<td style={{ color: l.deltaRub < 0 ? 'var(--red)' : 'var(--aurora)', fontVariantNumeric: 'tabular-nums' }}>{l.deltaRub < 0 ? '−' : '+'}{rub(Math.abs(l.deltaRub))}</td>
												<td className="muted">{rub(l.balanceAfter)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
}
