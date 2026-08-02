import { navigate } from '../lib/router';

// Shown to free-tier users on Trial+ features (Code, Executors).
export function Paywall({ feature, desc }: { feature: string; desc: string }) {
	return (
		<div style={{ maxWidth: 580 }}>
			<span className="hero-tag">◆ trial и выше</span>
			<h1 className="page" style={{ fontSize: 30, marginBottom: 12 }}>{feature}</h1>
			<p className="lead">{desc}</p>
			<div className="card" style={{ padding: 22 }}>
				<div style={{ fontWeight: 600, marginBottom: 6 }}>Доступно с тарифа Trial</div>
				<p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
					На бесплатном тарифе «{feature}» недоступен. Оформите Trial или Pro — получите агента, работающего в реальных проектах, подключение ПК/SSH и открытой IDE, а также все модели.
				</p>
				<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
					<button className="btn" onClick={() => navigate('/pricing')}>Смотреть тарифы →</button>
					<button className="btn ghost" onClick={() => navigate('/chat')}>Пока открыть чат</button>
				</div>
			</div>
		</div>
	);
}
