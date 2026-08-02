import { useEffect, useState } from 'react';
import { api, PlanCard } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { rub, credits } from '../lib/format';
import { handlePurchase, errText } from '../lib/pay';

export function Pricing() {
	const { user, refresh } = useAuth();
	const [plans, setPlans] = useState<PlanCard[]>([]);
	const [busy, setBusy] = useState<string | null>(null);
	const [msg, setMsg] = useState<string>('');
	const [annual, setAnnual] = useState(false);

	useEffect(() => { api.pricing().then(r => setPlans(r.plans)).catch(() => {}); }, []);

	async function buy(id: string) {
		if (!user) { navigate('/login'); return; }
		setBusy(id); setMsg('');
		try {
			const r = await api.checkout(id, { annual });
			setMsg(handlePurchase(r, rr => { void refresh(); return `✓ Тариф ${rr.user!.plan_label} активирован — списано ${rub(rr.charged!)} с кошелька.`; }));
		} catch (e: any) {
			setMsg('Ошибка: ' + errText(e.data?.error || e.message));
		} finally { setBusy(null); }
	}

	return (
		<div>
			<span className="hero-tag">◆ тарифы</span>
			<h1 className="page">Платите за <em>токены</em>, а не за воздух.</h1>
			<p className="lead">
				Три платных тарифа. Кратность ×5 и ×20 — это столько же квоты, сколько N × Pro, но дешевле.
				Неиспользованные кредиты внутри окна не сгорают раньше срока.
			</p>

			{msg && <p className={msg.startsWith('✓') ? 'ok' : 'err'}>{msg}</p>}

			<div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 10, marginBottom: 20 }}>
				<button className={annual ? 'btn ghost' : 'btn'} style={{ padding: '7px 16px', boxShadow: 'none' }} onClick={() => setAnnual(false)}>Помесячно</button>
				<button className={annual ? 'btn' : 'btn ghost'} style={{ padding: '7px 16px', boxShadow: 'none' }} onClick={() => setAnnual(true)}>Год <span style={{ color: annual ? '#06121d' : 'var(--aurora)', fontSize: 12 }}>−20%</span></button>
			</div>

			<div className="price-grid">
				{plans.map(p => {
					const featured = p.id === 'pro';
					const active = user?.plan === p.id;
					return (
						<div className={'price-card' + (featured ? ' featured' : '')} key={p.id}>
							{p.saveHint && <span className="save">{p.saveHint}</span>}
							<span className="tier">{p.id === 'pro' ? 'популярный' : `квота ×${p.factor}`}</span>
							<h3>{p.label}</h3>
							{annual ? (
								<>
									<div className="amt">{rub(p.annualRub)} <small>/ год</small></div>
									<div className="per">≈ {rub(p.annualMonthlyRub)} / мес · экономия {rub(p.priceRub * 12 - p.annualRub)}</div>
								</>
							) : (
								<>
									<div className="amt">{rub(p.priceRub)} <small>/ мес</small></div>
									{p.perProEquivalent && <div className="per">≈ {rub(p.perProEquivalent)} за 1 Pro</div>}
								</>
							)}
							<ul>
								<li>{credits(p.credits5h)} кредитов / 5 часов</li>
								<li>{credits(p.creditsWeek)} кредитов / неделю</li>
								<li>Все модели, полный агент</li>
								<li>{p.blurb}</li>
							</ul>
							<button className={'btn' + (featured ? '' : ' ghost') + ' block'} disabled={busy === p.id || active} onClick={() => buy(p.id)}>
								{active ? 'Ваш тариф' : busy === p.id ? '…' : `Выбрать ${p.label} →`}
							</button>
						</div>
					);
				})}
			</div>

			<div className="section-title">// как считаются кредиты</div>
			<div className="card">
				<p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
					1 запрос стоит <b style={{ color: 'var(--ink)' }}>1 кредит × множитель модели</b> (лёгкие — 0.5×, Opus — до 2.8×).
					Два скользящих окна: <b style={{ color: 'var(--ice)' }}>5 часов</b> (защита от всплесков) и{' '}
					<b style={{ color: 'var(--ice)' }}>7 дней</b>. Достигли лимита — ждёте сброса самого старого запроса из окна.
				</p>
			</div>
		</div>
	);
}
