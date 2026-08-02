import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { startGoogleLogin } from '../lib/googleAuth';

function GoogleButton() {
	const [cfg, setCfg] = useState<{ enabled: boolean; clientId: string; redirectUri: string; scope: string } | null>(null);
	useEffect(() => { api.googleConfig().then(setCfg).catch(() => {}); }, []);
	if (!cfg?.enabled) { return null; }
	return (
		<>
			<button type="button" className="btn ghost block" style={{ gap: 10, justifyContent: 'center', marginBottom: 4 }} onClick={() => startGoogleLogin(cfg)}>
				<svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 36.4 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
				Войти через Google
			</button>
			<div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--mute)', fontSize: 12, margin: '10px 0 14px' }}>
				<span style={{ flex: 1, height: 1, background: 'var(--line)' }} /> или <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
			</div>
		</>
	);
}

export function Login({ mode }: { mode: 'login' | 'register' }) {
	const { login, register } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [err, setErr] = useState('');
	const [busy, setBusy] = useState(false);
	const [sentTo, setSentTo] = useState<string | null>(null); // shown after register / when unverified
	const [devLink, setDevLink] = useState<string | null>(null);
	const [resent, setResent] = useState(false);
	const isReg = mode === 'register';

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setErr(''); setBusy(true);
		try {
			if (isReg) {
				const r = await register(email, password);
				setSentTo(r.email || email);
				if (r.devVerifyToken) { setDevLink('#/verify/' + r.devVerifyToken); }
				return;
			}
			await login(email, password);
			const pendingRef = localStorage.getItem('xipher.pendingRef');
			if (pendingRef) { localStorage.removeItem('xipher.pendingRef'); navigate('/r/' + pendingRef); } else { navigate('/dashboard'); }
		} catch (e: any) {
			const code = e.data?.error;
			if (code === 'email_not_verified') { setSentTo(e.data?.email || email); return; }
			setErr(
				code === 'email_taken' ? 'Этот email уже зарегистрирован' :
				code === 'bad_credentials' ? 'Неверный email или пароль' :
				code === 'bad_password' ? (e.data?.message || 'Слабый пароль') :
				code === 'bad_email' ? 'Некорректный email' :
				code === 'rate_limited' ? 'Слишком много попыток — попробуйте позже' :
				e.message,
			);
		} finally { setBusy(false); }
	}

	async function resend() {
		setResent(false);
		try { await api.resendVerification(sentTo || email); setResent(true); } catch { /* ignore */ }
	}

	// "Check your email" panel (after register, or when login hits unverified)
	if (sentTo) {
		return (
			<div className="form-narrow">
				<span className="hero-tag">◆ подтвердите e-mail</span>
				<h1 className="page" style={{ fontSize: 30 }}>Проверьте почту</h1>
				<p className="lead">
					Мы отправили письмо на <b style={{ color: 'var(--ink)' }}>{sentTo}</b>. Перейдите по ссылке из письма,
					чтобы активировать аккаунт и войти. Ссылка действует 24 часа.
				</p>
				{devLink && <p className="ok">DEV: <a href={devLink}>подтвердить сразу →</a></p>}
				<button className="btn ghost" onClick={resend}>Отправить письмо ещё раз</button>
				{resent && <p className="ok" style={{ marginTop: 10 }}>✓ Письмо отправлено повторно.</p>}
				<p className="muted" style={{ marginTop: 16 }}>Не туда? <a href="#/register" onClick={() => { setSentTo(null); setDevLink(null); }}>Изменить email</a></p>
			</div>
		);
	}

	return (
		<div className="form-narrow">
			<span className="hero-tag">◆ {isReg ? 'регистрация' : 'вход'}</span>
			<h1 className="page" style={{ fontSize: 32 }}>{isReg ? 'Создать аккаунт' : 'С возвращением'}</h1>
			<p className="lead" style={{ marginBottom: 22 }}>
				{isReg ? 'Free-тариф без карты. Быстрее всего — через Google (email подтвердится сам).' : 'Войдите, чтобы управлять тарифом и кредитами.'}
			</p>
			<GoogleButton />
			<form onSubmit={submit}>
				<div className="field">
					<label>Email</label>
					<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
				</div>
				<div className="field">
					<label>Пароль {isReg && <span className="muted">· минимум 8 символов, буквы и цифры</span>}</label>
					<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isReg ? 'new-password' : 'current-password'} required />
				</div>
				{err && <p className="err">{err}</p>}
				<button className="btn block" disabled={busy} type="submit">{busy ? '…' : isReg ? 'Зарегистрироваться →' : 'Войти →'}</button>
			</form>
			<p className="muted" style={{ marginTop: 16 }}>
				{isReg ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
				<a href={isReg ? '#/login' : '#/register'}>{isReg ? 'Войти' : 'Создать'}</a>
			</p>
		</div>
	);
}
