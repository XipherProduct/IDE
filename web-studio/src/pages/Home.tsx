import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useAuth } from '../lib/auth';
import { api, PlanCard } from '../lib/api';
import { rub, credits } from '../lib/format';

export function Home() {
	const { user } = useAuth();
	const [plans, setPlans] = useState<PlanCard[]>([]);
	useEffect(() => { api.pricing().then(r => setPlans(r.plans)).catch(() => {}); }, []);

	return (
		<div>
			<span className="hero-tag">◆ Xipher IDE · полярная ночь</span>
			<h1 className="page">Агент, который живёт <em>внутри</em> вашего кода.</h1>
			<p className="lead">
				Xipher — форк VS Code со встроенным AI-агентом: читает проект целиком, правит файлы,
				держит терминал и контекст. Топовые модели — прямо из России, без прокси.
			</p>
			<div className="vpn-badge">⚡ Claude Opus 5 · Sonnet 5 · и другие топ-модели — <b>работают из России без VPN</b></div>
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
				<button className="btn" onClick={() => navigate(user ? '/dashboard' : '/register')}>{user ? 'В кабинет →' : 'Начать бесплатно →'}</button>
				<button className="btn ghost" onClick={() => navigate('/download')}>↓ Скачать IDE</button>
					<button className="btn ghost" onClick={() => navigate('/pricing')}>Тарифы</button>
			</div>

			{/* stats */}
			<div className="metrics-row" style={{ marginTop: 34 }}>
				{[['21', 'модель'], ['до 1M', 'токенов контекста'], ['без VPN', 'из России'], ['1 файл', 'без прав админа']].map(([v, k]) => (
					<div className="stat metric-big" key={k}><div className="v">{v}</div><div className="k">{k}</div></div>
				))}
			</div>

			{/* models */}
			<div className="section-title">// модели под капотом</div>
			<div className="logos">
				{['Claude Opus 5', 'Claude Sonnet 5', 'Claude Opus 4.8', 'DeepSeek V4', 'Qwen3.7', 'GLM 5', 'MiniMax M2.5', 'Fable 5'].map(m => (
					<span className="logo-chip" key={m}>{m}</span>
				))}
			</div>

			{/* features */}
			<div className="section-title">// почему Xipher</div>
			<div className="grid2">
				{[
					['Без VPN — из России', 'Claude Opus 5, Sonnet 5 и другие топ-модели работают прямо из РФ. Проксирование берём на себя — ваш IP до провайдеров не доходит, VPN не нужен.'],
					['Полный агент', 'Читает и редактирует весь проект, а не один файл. Терминал, поиск, git, под-агенты — из коробки.'],
					['Прозрачные кредиты', '1 кредит ≈ 1 запрос × множитель модели. Два окна лимитов: 5 часов и неделя.'],
					['Реф-программа', 'На платном тарифе делитесь ссылкой — друг берёт Pro на 7 дней за 49 ₽, вы получаете бонус.'],
				].map(([t, d]) => (
					<div className="card" key={t}><h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{t}</h3><p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{d}</p></div>
				))}
			</div>

			{/* how it works */}
			<div className="section-title">// как начать</div>
			<div className="steps">
				{[
					['1', 'Регистрация', 'Создайте аккаунт — Free-тариф без карты, дешёвые модели сразу.'],
					['2', 'Установка', 'Скачайте Xipher для Windows или Linux — один файл, без прав администратора.'],
					['3', 'Вход в IDE', 'Войдите через устройство — кабинет свяжется с редактором.'],
					['4', 'Кодьте с агентом', 'Откройте чат, дайте задачу — агент читает проект и правит файлы.'],
				].map(([n, t, d]) => (
					<div className="step" key={n}><div className="n">{n}</div><h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t}</h3><p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: 13.5 }}>{d}</p></div>
				))}
			</div>

			{/* pricing preview */}
			<div className="section-title">// тарифы</div>
			<div className="price-grid">
				{plans.map(p => (
					<div className={'price-card' + (p.id === 'pro' ? ' featured' : '')} key={p.id}>
						{p.saveHint && <span className="save">{p.saveHint}</span>}
						<span className="tier">{p.id === 'pro' ? 'популярный' : `квота ×${p.factor}`}</span>
						<h3>{p.label}</h3>
						<div className="amt">{rub(p.priceRub)} <small>/ мес</small></div>
						<ul><li>{credits(p.creditsWeek)} кредитов / неделю</li><li>все модели, полный агент</li></ul>
						<button className={'btn' + (p.id === 'pro' ? '' : ' ghost') + ' block'} onClick={() => navigate('/pricing')}>Подробнее →</button>
					</div>
				))}
			</div>

			{/* FAQ */}
			<div className="section-title">// вопросы</div>
			<div className="card">
				{[
					['Нужен ли VPN?', 'Нет. Claude Opus/Sonnet и остальные модели работают из России без VPN — наш сервер сам ходит к провайдерам, ваш IP до них не доходит. Вы просто открываете ide.xipher.pro.'],
					['Что такое кредиты?', '1 кредит ≈ 1 запрос к модели, умноженный на её множитель (лёгкие — 0.5×, Opus — до 3×). Есть два окна: 5 часов и неделя.'],
					['Можно вернуть деньги?', 'Да, администратор может оформить возврат — средства вернутся на кошелёк, откуда их можно потратить на любой тариф.'],
					['Как работает реф-ссылка?', 'На платном тарифе вы получаете ссылку. Друг оформляет по ней Pro на 7 дней за 49 ₽, а вам капает бонус на кошелёк.'],
					['Нужна ли карта для Free?', 'Нет. Free-тариф доступен сразу после регистрации, без карты — с дешёвыми моделями.'],
				].map(([q, a]) => (
					<details className="faq-item" key={q}><summary>{q}</summary><p>{a}</p></details>
				))}
			</div>

			{/* final CTA */}
			<div className="card" style={{ marginTop: 30, textAlign: 'center', padding: 34, background: 'radial-gradient(circle at 50% 0%, oklch(0.83 0.10 220 / .12), transparent 70%), var(--panel)' }}>
				<h2 style={{ margin: '0 0 10px', fontSize: 24 }}>Готовы попробовать?</h2>
				<p className="muted" style={{ margin: '0 auto 18px', maxWidth: '40ch' }}>Начните на Free, апгрейдьтесь когда понадобится. Кредиты не сгорают раньше срока.</p>
				<button className="btn" onClick={() => navigate(user ? '/dashboard' : '/register')}>{user ? 'В кабинет →' : 'Создать аккаунт →'}</button>
			</div>
		</div>
	);
}
