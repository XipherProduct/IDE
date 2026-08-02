export function rub(n: number): string {
	return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}
export function credits(n: number): string {
	if (n >= 1000) { return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'; }
	return String(Math.round(n));
}
export function date(ts: number | null): string {
	if (!ts) { return '—'; }
	return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function humanReset(sec: number): string {
	if (!sec) { return '—'; }
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
	if (h >= 24) { return `${Math.floor(h / 24)} д`; }
	if (h) { return `${h} ч ${m} м`; }
	return `${m} м`;
}
