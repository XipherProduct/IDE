import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api, ReferralInfo, Activity } from '../lib/api';
import { navigate } from '../lib/router';
import { Heatmap } from '../components/Heatmap';
import { rub, credits, date, humanReset } from '../lib/format';

function Meter({ used, limit, resetS, label }: { used: number; limit: number; resetS: number; label: string }) {
	const pct = Math.min(100, limit ? (used / limit) * 100 : 0);
	const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
	return (
		<div className="stat">
			<div className="k">{label}</div>
			<div className="v">{credits(used)} <span style={{ fontSize: 14, color: 'var(--mute)' }}>/ {credits(limit)}</span></div>
			<div className="meter"><i className={cls} style={{ width: pct + '%' }} /></div>
			<div className="muted" style={{ marginTop: 8, fontSize: 12 }}>сброс через {humanReset(resetS)}</div>
		</div>
	);
}

const UPDATE_MODES: { id: 'off' | 'notify' | 'silent'; label: string; hint: string }[] = [
	{ id: 'off', label: 'Выкл', hint: 'Не проверять обновления' },
	{ id: 'notify', label: 'Уведомлять', hint: 'Показать уведомление со ссылкой на скачивание' },
	{ id: 'silent', label: 'Тихо', hint: 'Скачивать автоматически в фоне' },
];

export function Dashboard() {
	const { user, usage, loading, logout, refresh } = useAuth();
	const [ref, setRef] = useState<ReferralInfo | null>(null);
	const [act, setAct] = useState<Activity | null>(null);
	const [copied, setCopied] = useState(false);
	const [updBusy, setUpdBusy] = useState(false);

	async function setUpdateMode(mode: 'off' | 'notify' | 'silent') {
		setUpdBusy(true);
		try { await api.setAutoUpdate(mode); await refresh(); } catch { /* ignore */ } finally { setUpdBusy(false); }
	}

	useEffect(() => {
		if (user) {
			api.referralMine().then(setRef).catch(() => {});
			api.activity().then(setAct).catch(() => {});
		}
	}, [user]);

	if (loading) { return <p className="muted">Загрузка…</p>; }
	if (!user) { navigate('/login'); return null; }
	const paid = user.plan !== 'free';

	return (
		<div>
			<span className="hero-tag">◆ личный кабинет</span>
			<h1 className="page" style={{ fontSize: 30 }}>Привет, {user.name}</h1>

			<div className="grid2" style={{ marginBottom: 8 }}>
				<div className="card">
					<div className="k" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.08em' }}>текущий тариф</div>
					<h3 style={{ margin: '8px 0 4px', fontSize: 24, color: 'var(--ice)' }}>{user.plan_label}</h3>
					{paid && <div className="muted">{user.autoRenew ? 'автопродление вкл · ' : 'автопродление выкл · '}до {date(user.planExpiresAt)}</div>}
					<div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
						<button className="btn ghost" onClick={() => navigate('/pricing')}>{paid ? 'Сменить тариф' : 'Улучшить →'}</button>
						<button className="btn ghost" onClick={() => navigate('/billing')}>Биллинг</button>
						<button className="btn ghost" onClick={() => { void logout(); navigate('/'); }}>Выйти</button>
					</div>
				</div>
				<div className="card">
					<div className="k" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.08em' }}>аккаунт</div>
					<div style={{ marginTop: 10, lineHeight: 1.9 }}>
						<div><span className="muted">email</span> &nbsp; {user.email}</div>
						<div><span className="muted">кошелёк</span> &nbsp; {rub(user.balanceRub)} · <span className="muted">бонус-кредиты</span> {credits(user.bonusCredits)}</div>
						<div><span className="muted">с нами с</span> &nbsp; {date(user.createdAt)}</div>
						{user.isAdmin && <div><a href="#/admin">→ Админ-панель</a></div>}
					</div>
				</div>
			</div>

			{/* activity heatmap */}
			<div className="section-title">// активность</div>
			<div className="card">
				{act ? (
					<>
						<div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 16 }}>
							<div><b style={{ fontSize: 20 }}>{act.activeDays}</b> <span className="muted" style={{ fontSize: 13 }}>активных дней</span></div>
							<div><b style={{ fontSize: 20 }}>{act.currentStreak}</b> <span className="muted" style={{ fontSize: 13 }}>дней подряд</span></div>
							<div><b style={{ fontSize: 20 }}>{act.bestStreak}</b> <span className="muted" style={{ fontSize: 13 }}>лучшая серия</span></div>
							<div><b style={{ fontSize: 20 }}>{credits(act.totalCredits)}</b> <span className="muted" style={{ fontSize: 13 }}>кредитов за {Math.round(act.windowDays / 7)} нед</span></div>
						</div>
						<Heatmap data={act} />
						{act.activeDays === 0 && <p className="muted" style={{ marginTop: 14, marginBottom: 0, fontSize: 13 }}>Пока пусто — активность появится, когда начнёте пользоваться агентом и покупками.</p>}
					</>
				) : <p className="muted" style={{ margin: 0 }}>Загрузка активности…</p>}
			</div>

			<div className="section-title">// кредиты сейчас</div>
			<div className="grid2">
				{usage && <Meter label="окно 5 часов" used={usage.credits5h_used} limit={usage.credits5h_limit} resetS={usage.credits5h_reset_s} />}
				{usage && <Meter label="окно 7 дней" used={usage.creditsWeek_used} limit={usage.creditsWeek_effective_limit ?? usage.creditsWeek_limit} resetS={usage.creditsWeek_reset_s} />}
			</div>

			<div className="section-title">// обновления IDE</div>
			<div className="card">
				<p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
					Как Xipher IDE ведёт себя при выходе новой версии (применяется к твоему аккаунту на всех устройствах).
				</p>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{UPDATE_MODES.map(m => {
						const active = (user.autoUpdate || 'notify') === m.id;
						return (
							<button key={m.id} className={'btn' + (active ? '' : ' ghost')} disabled={updBusy}
								title={m.hint} style={{ flex: '1 1 140px', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 14px' }}
								onClick={() => !active && setUpdateMode(m.id)}>
								<span style={{ fontWeight: 600 }}>{active ? '✓ ' : ''}{m.label}</span>
								<span style={{ fontSize: 11, opacity: .8, fontWeight: 400 }}>{m.hint}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="section-title">// реферальная ссылка</div>
			<div className="card">
				{ref?.eligible ? (
					<>
						<p className="muted" style={{ marginTop: 0 }}>
							Поделитесь ссылкой — друг получит <b style={{ color: 'var(--ink)' }}>Pro на {ref.grantsDays} дней за {rub(ref.redeemPriceRub)}</b>, вы — бонус на кошелёк.
							Активаций: <b style={{ color: 'var(--aurora)' }}>{ref.uses}</b>. Заработано: <b style={{ color: 'var(--aurora)' }}>{rub(user.referralEarningsRub)}</b>.
						</p>
						<div className="copybox">
							<code>{ref.url}</code>
							<button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => { navigator.clipboard?.writeText(ref.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '✓ скопировано' : 'копировать'}</button>
						</div>
					</>
				) : <p className="muted" style={{ margin: 0 }}>{ref?.reason || 'Реф-ссылка доступна только на платном тарифе.'} <a href="#/pricing">Оформить Pro →</a></p>}
			</div>
		</div>
	);
}
