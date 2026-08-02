import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { rub } from '../lib/format';
import { handlePurchase, errText } from '../lib/pay';

export function Redeem({ code }: { code: string }) {
	const { user, refresh } = useAuth();
	const [preview, setPreview] = useState<any>(null);
	const [msg, setMsg] = useState('');
	const [busy, setBusy] = useState(false);

	useEffect(() => { api.referralPreview(code).then(setPreview).catch(() => setPreview({ ok: false })); }, [code]);

	async function redeem(method: 'card' | 'balance' = 'card') {
		if (!user) { localStorage.setItem('xipher.pendingRef', code); navigate('/register'); return; }
		setBusy(true); setMsg('');
		try {
			const r = await api.referralRedeem(code, method);
			setMsg(handlePurchase(r, rr => { void refresh(); setTimeout(() => navigate('/dashboard'), 1400); return `✓ Готово! Pro активирован на ${rr.grantedDays} дней.`; }));
		} catch (e: any) {
			setMsg('Ошибка: ' + errText(e.data?.error || e.message));
		} finally { setBusy(false); }
	}

	if (!preview) { return <p className="muted">Проверяем ссылку…</p>; }
	if (!preview.ok || !preview.valid) {
		return (
			<div className="form-narrow">
				<h1 className="page" style={{ fontSize: 30 }}>Ссылка недействительна</h1>
				<p className="lead">{preview.reason || 'Такой реф-код не найден или истёк.'}</p>
				<button className="btn ghost" onClick={() => navigate('/pricing')}>Смотреть тарифы →</button>
			</div>
		);
	}

	return (
		<div className="form-narrow">
			<span className="hero-tag">◆ приглашение</span>
			<h1 className="page" style={{ fontSize: 30 }}>{preview.inviter} дарит вам <span style={{ color: 'var(--ice)' }}>{preview.plan_label}</span></h1>
			<p className="lead">
				Активируйте <b style={{ color: 'var(--ink)' }}>{preview.plan_label} на {preview.days} дней</b> за {rub(preview.priceRub)}
				&nbsp;— вместо 999 ₽ за месяц. Все модели и полный агент.
			</p>
			{msg && <p className={msg.startsWith('✓') ? 'ok' : 'err'}>{msg}</p>}
			<button className="btn block" disabled={busy} onClick={() => redeem('card')}>
				{busy ? '…' : user ? `Оплатить картой ${rub(preview.priceRub)} →` : 'Зарегистрироваться и активировать →'}
			</button>
			{user && (user.balanceRub >= preview.priceRub) && (
				<button className="btn ghost block" style={{ marginTop: 8 }} disabled={busy} onClick={() => redeem('balance')}>
					Оплатить с кошелька ({rub(user.balanceRub)})
				</button>
			)}
			{!user && <p className="muted" style={{ marginTop: 14 }}>Нужен аккаунт — зарегистрируем в один шаг.</p>}
		</div>
	);
}
