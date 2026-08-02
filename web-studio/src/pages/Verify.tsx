import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';

export function Verify({ token }: { token: string }) {
	const { verifyEmail } = useAuth();
	const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
	const [err, setErr] = useState('');

	useEffect(() => {
		let alive = true;
		verifyEmail(token)
			.then(() => { if (alive) { setState('ok'); const pref = localStorage.getItem('xipher.pendingRef'); if (pref) { localStorage.removeItem('xipher.pendingRef'); } setTimeout(() => navigate(pref ? '/r/' + pref : '/dashboard'), 1200); } })
			.catch((e: any) => { if (alive) { setState('fail'); setErr(e.data?.error === 'expired' ? 'ссылка истекла' : e.data?.error === 'invalid_token' ? 'ссылка недействительна' : (e.data?.error || e.message)); } });
		return () => { alive = false; };
	}, [token, verifyEmail]);

	return (
		<div className="form-narrow">
			<span className="hero-tag">◆ подтверждение e-mail</span>
			{state === 'working' && <><h1 className="page" style={{ fontSize: 30 }}>Подтверждаем…</h1><p className="muted">Секунду.</p></>}
			{state === 'ok' && <><h1 className="page" style={{ fontSize: 30 }}>✓ E-mail подтверждён</h1><p className="lead">Аккаунт активирован — открываем кабинет…</p></>}
			{state === 'fail' && (
				<>
					<h1 className="page" style={{ fontSize: 30 }}>Не удалось подтвердить</h1>
					<p className="err">Ошибка: {err}</p>
					<p className="lead">Запросите новое письмо на странице входа.</p>
					<button className="btn ghost" onClick={() => navigate('/login')}>На страницу входа →</button>
				</>
			)}
		</div>
	);
}
