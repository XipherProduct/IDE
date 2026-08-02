import { api, PurchaseResult } from './api';

const PENDING_KEY = 'xipher.pendingInvoice';

// Handle a purchase response. If the gateway needs the user to pay, remember the
// invoice and redirect to the confirmation page. If it settled instantly (wallet
// or fully-discounted), return a success message. Throws a readable error string.
export function handlePurchase(r: PurchaseResult, onPaid: (r: PurchaseResult) => string): string {
	if (r.pending && r.confirmationUrl) {
		if (r.invoiceId) { localStorage.setItem(PENDING_KEY, r.invoiceId); }
		window.location.href = r.confirmationUrl;
		return 'Переходим к оплате…';
	}
	if (r.paid) { return onPaid(r); }
	throw new Error(errText(r.error));
}

export function errText(code?: string): string {
	switch (code) {
		case 'payments_not_configured': return 'Оплата картой временно недоступна. Пополните кошелёк или попробуйте позже.';
		case 'insufficient_balance': return 'Недостаточно средств на кошельке.';
		case 'gateway_unreachable': return 'Платёжный шлюз недоступен, попробуйте позже.';
		case 'already_referred': return 'Вы уже активировали реф-ссылку.';
		case 'already_paid': return 'У вас уже платный тариф.';
		case 'inviter_not_paid': return 'Пригласивший больше не на платном тарифе.';
		case 'self_referral': return 'Нельзя активировать свою же ссылку.';
		default: return code || 'Ошибка';
	}
}

// On returning from the gateway, poll the pending invoice until it settles.
// Returns the final status string, or null if there was nothing pending.
export async function resolvePendingReturn(): Promise<string | null> {
	const id = localStorage.getItem(PENDING_KEY);
	if (!id) { return null; }
	for (let i = 0; i < 8; i++) {
		try {
			const s = await api.invoiceStatus(id);
			if (s.status === 'paid') { localStorage.removeItem(PENDING_KEY); return 'ok'; }
			if (s.status === 'failed' || s.status === 'refunded') { localStorage.removeItem(PENDING_KEY); return 'failed'; }
		} catch { /* keep trying */ }
		await new Promise(r => setTimeout(r, 1200));
	}
	return 'pending';
}
