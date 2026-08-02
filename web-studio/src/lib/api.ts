// Typed client for the site backend. Token is kept in localStorage and sent as a
// Bearer header. In dev, /api is proxied to :8098 by Vite.

const TOKEN_KEY = 'xipher.session';

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string | null) { if (t) { localStorage.setItem(TOKEN_KEY, t); } else { localStorage.removeItem(TOKEN_KEY); } }

export interface PublicUser {
	id: string; email: string; name: string;
	plan: string; plan_label: string;
	planExpiresAt: number | null;
	isAdmin: boolean; referralCode: string; createdAt: number;
	balanceRub: number; bonusCredits: number; autoRenew: boolean; referralEarningsRub: number;
	autoUpdate: 'off' | 'notify' | 'silent';
}
export interface Usage {
	plan: string; plan_label: string;
	credits5h_used: number; credits5h_limit: number;
	creditsWeek_used: number; creditsWeek_limit: number;
	creditsWeek_effective_limit?: number; bonusCredits?: number;
	credits5h_reset_s: number; creditsWeek_reset_s: number;
}
export interface PlanCard {
	id: string; label: string; priceRub: number; periodDays: number;
	annualRub: number; annualMonthlyRub: number;
	factor: number; saveHint: string | null;
	credits5h: number; creditsWeek: number; blurb: string;
	perProEquivalent: number | null;
}
export interface ReferralInfo {
	eligible: boolean; reason: string | null; code: string; url: string;
	redeemPriceRub: number; grantsDays: number; uses: number;
}
export interface CreditPack { id: string; label: string; credits: number; priceRub: number; perCredit: number; }
export interface InvoiceItem { label: string; amountRub: number; qty?: number; }
export interface Invoice {
	id: string; ts: number; kind: string; items: InvoiceItem[];
	subtotalRub: number; discountRub: number; totalRub: number;
	method: string; promo: string | null; status: string; meta?: any;
}
export interface LedgerEntry { id: string; ts: number; deltaRub: number; reason: string; balanceAfter: number; }
export interface Promo { code: string; kind: 'percent' | 'fixed'; value: number; appliesTo: string; uses: number; maxUses: number | null; active: boolean; minRub: number; expiresAt: number | null; }
export interface BillingCatalog { plans: PlanCard[]; creditPacks: CreditPack[]; topupPresets: number[]; topupBounds: { min: number; max: number }; paymentsEnabled: boolean; }
export interface ActivityDay { date: string; credits: number; requests: number; events: number; level: number; }
export interface Activity { days: ActivityDay[]; totalCredits: number; totalRequests: number; activeDays: number; bestStreak: number; currentStreak: number; windowDays: number; }
export interface DownloadItem {
	id: string; file: string; os: 'windows' | 'linux'; ext: string;
	kind: string; label: string; hint: string; recommended?: boolean;
	available: boolean; size: number; sizeh: string; url: string | null; updatedAt: number;
}
export interface DownloadManifest { version: string; items: DownloadItem[]; }
export interface PurchaseResult {
	ok: boolean; error?: string;
	pending?: boolean; confirmationUrl?: string; invoiceId?: string; due?: number;
	paid?: boolean; user?: PublicUser; charged?: number; method?: string; invoice?: Invoice;
	grantedDays?: number; credited?: number; credits?: number;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
	const token = getToken();
	const r = await fetch(path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = await r.json().catch(() => ({}));
	if (!r.ok) { throw Object.assign(new Error((data as any).message || (data as any).error || `HTTP ${r.status}`), { status: r.status, data }); }
	return data as T;
}

export const api = {
	pricing: () => req<{ plans: PlanCard[] }>('GET', '/xapi/pricing'),
	downloads: () => req<DownloadManifest>('GET', '/xapi/downloads'),
	register: (email: string, password: string) => req<{ ok: boolean; emailVerificationRequired: boolean; email: string; devVerifyToken?: string }>('POST', '/xapi/auth/register', { email, password }),
	verifyEmail: (token: string) => req<{ ok: boolean; token: string; user: PublicUser }>('POST', '/xapi/auth/verify', { token }),
	resendVerification: (email: string) => req<{ ok: boolean }>('POST', '/xapi/auth/resend', { email }),
	googleConfig: () => req<{ enabled: boolean; clientId: string; redirectUri: string; scope: string }>('GET', '/xapi/auth/google/config'),
	googleAuth: (code: string, redirectUri: string) => req<{ ok: boolean; token: string; user: PublicUser }>('POST', '/xapi/auth/google', { code, redirectUri }),
	login: (email: string, password: string) => req<{ token: string; user: PublicUser }>('POST', '/xapi/auth/login', { email, password }),
	logout: () => req<{ ok: boolean }>('POST', '/xapi/auth/logout'),
	me: () => req<{ user: PublicUser; usage: Usage }>('GET', '/xapi/me'),
	activity: (days?: number) => req<Activity>('GET', `/xapi/me/activity${days ? `?days=${days}` : ''}`),
	checkout: (plan: string, opts?: { promoCode?: string; method?: 'card' | 'balance'; annual?: boolean }) =>
		req<PurchaseResult>('POST', '/xapi/billing/checkout', { plan, ...(opts || {}) }),
	billingCatalog: () => req<BillingCatalog>('GET', '/xapi/billing/catalog'),
	upgradePreview: (plan: string, annual?: boolean) => req<{ ok: boolean; base: number; prorationCredit: number; dueNow: number }>('GET', `/xapi/billing/upgrade-preview?plan=${plan}${annual ? '&annual=1' : ''}`),
	topup: (amountRub: number, promoCode?: string) => req<PurchaseResult>('POST', '/xapi/billing/topup', { amountRub, promoCode }),
	buyCredits: (packId: string, opts?: { promoCode?: string; method?: 'card' | 'balance' }) => req<PurchaseResult>('POST', '/xapi/billing/credits', { packId, ...(opts || {}) }),
	invoiceStatus: (id: string) => req<{ id: string; status: string; kind: string; totalRub: number }>('GET', `/xapi/billing/invoice/${id}/status`),
	promoPreview: (code: string, target: string, baseRub: number) => req<{ ok: boolean; error?: string; discountRub: number; finalRub: number; label: string }>('POST', '/xapi/billing/promo/preview', { code, target, baseRub }),
	invoices: () => req<{ invoices: Invoice[]; ledger: LedgerEntry[]; balanceRub: number; bonusCredits: number }>('GET', '/xapi/billing/invoices'),
	autoRenew: (on: boolean) => req<{ ok: boolean; autoRenew: boolean; user: PublicUser }>('POST', '/xapi/billing/auto-renew', { on }),
	setAutoUpdate: (mode: 'off' | 'notify' | 'silent') => req<{ ok: boolean; autoUpdate: string }>('POST', '/xapi/me/auto-update', { mode }),
	cancelSub: () => req<{ ok: boolean; endsAt: number }>('POST', '/xapi/billing/cancel', {}),
	referralMine: () => req<ReferralInfo>('GET', '/xapi/referral'),
	referralPreview: (code: string) => req<{ ok: boolean; valid: boolean; reason: string | null; inviter: string; priceRub: number; days: number; plan_label: string; error?: string }>('GET', `/xapi/referral/${encodeURIComponent(code)}`),
	referralRedeem: (code: string, method?: 'card' | 'balance') => req<PurchaseResult>('POST', `/xapi/referral/${encodeURIComponent(code)}/redeem`, { method }),
	adminOverview: () => req<any>('GET', '/xapi/admin/overview'),
	adminSetPlan: (email: string, plan: string, days?: number) => req<any>('POST', '/xapi/admin/user-plan', { email, plan, days }),
	adminMetrics: () => req<any>('GET', '/xapi/admin/metrics'),
	adminInvoices: () => req<{ invoices: Invoice[] }>('GET', '/xapi/admin/invoices'),
	adminRefund: (invoiceId: string, revokePlan?: boolean) => req<any>('POST', '/xapi/admin/refund', { invoiceId, revokePlan }),
	adminGrant: (email: string, opts: { credits?: number; balanceRub?: number; plan?: string; days?: number }) => req<any>('POST', '/xapi/admin/grant', { email, ...opts }),
	adminPromos: () => req<{ promos: Promo[]; stats: { total: number; active: number; redemptions: number } }>('GET', '/xapi/admin/promos'),
	adminCreatePromo: (p: { code: string; kind: string; value: number; appliesTo: string; maxUses?: number; minRub?: number }) => req<any>('POST', '/xapi/admin/promo', p),
	adminTogglePromo: (code: string, active: boolean) => req<any>('POST', '/xapi/admin/promo/toggle', { code, active }),
	// IDE / Web-Code fleet (proxied to ide-backend)
	adminIde: () => req<any>('GET', '/xapi/admin/ide'),
	adminIdeRevokeExecutor: (executorId: string) => req<{ ok: boolean }>('POST', '/xapi/admin/ide/executor-revoke', { executorId }),
	adminIdeApprove: (user_code: string, userId: string) => req<any>('POST', '/xapi/admin/ide/approve', { user_code, userId }),
};

// ---- Web "Code" platform (agent sessions on the ide-backend) ----------------

export type Workspace = { kind: 'none' | 'echo' | 'local' | 'ssh' | 'ide'; ref: string };
export interface CodeSession {
	id: string; title: string; createdAt?: number; updatedAt?: number;
	model: string | null; agentMode: string; permissionMode: string;
	reasoningEffort?: string | null; workspace: Workspace; seq: number;
}
export interface CodeMessage {
	id: string; seq: number; role: 'user' | 'assistant' | 'tool' | 'system' | 'error';
	content: string; ts: number; reasoning?: string; model?: string;
	tool_calls?: any[]; tool_call_id?: string; name?: string; usage?: { input: number; output: number }; credits?: number;
}
export interface CodeModel {
	id: string; label: string; provider: string; context_tokens: number;
	requires_plan: string; supports_reasoning_effort: boolean; credit_multiplier: number; locked: boolean;
}
export interface CreateSessionOpts {
	title?: string; model?: string | null; agentMode?: string; permissionMode?: string;
	reasoningEffort?: string | null; workspaceKind?: Workspace['kind']; workspaceRef?: string;
}

// The Code API lives on the ide-backend, reached under /ide-api (prod) — proxied
// in dev by Vite. Same site-session bearer as the rest of the app.
async function codeReq<T>(method: string, path: string, body?: unknown): Promise<T> {
	const token = getToken();
	const r = await fetch('/ide-api' + path, {
		method,
		headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = await r.json().catch(() => ({}));
	if (!r.ok) { throw Object.assign(new Error((data as any).message || `HTTP ${r.status}`), { status: r.status, data }); }
	return data as T;
}

export interface Executor {
	id: string; kind: 'local' | 'ssh'; name: string; root: string; os: string;
	caps: string[]; createdAt: number; lastSeen: number; status: 'online' | 'offline';
}
export interface MemoryFact { id: string; text: string; source: string; createdAt: number; updatedAt: number; }
export interface PairInfo { code: string; kind: string; expiresInMs: number; command: string; runCommand?: string; hint: string; }

export const codeApi = {
	models: () => codeReq<{ items: CodeModel[]; plan: string; plan_label: string }>('GET', '/api/agent/models'),
	// executors (Phase 2 — pair a local daemon / SSH host)
	listExecutors: () => codeReq<{ executors: Executor[] }>('GET', '/api/agent/executors'),
	pairInit: (kind: 'local' | 'ssh') => codeReq<PairInfo>('POST', '/api/agent/executors/pair-init', { kind }),
	revokeExecutor: (id: string) => codeReq<{ ok: boolean }>('DELETE', `/api/agent/executors/${id}`),
	// per-user memory (Phase 4)
	getMemory: () => codeReq<{ facts: MemoryFact[] }>('GET', '/api/agent/memory'),
	addMemory: (text: string) => codeReq<{ fact: MemoryFact }>('POST', '/api/agent/memory', { text }),
	deleteMemory: (id: string) => codeReq<{ ok: boolean }>('DELETE', `/api/agent/memory/${id}`),
	listSessions: () => codeReq<{ sessions: CodeSession[] }>('GET', '/api/agent/sessions'),
	createSession: (opts: CreateSessionOpts) => codeReq<{ session: CodeSession }>('POST', '/api/agent/sessions', opts),
	getMessages: (id: string, since = 0) => codeReq<{ session: CodeSession | null; messages: CodeMessage[]; running: boolean }>('GET', `/api/agent/sessions/${id}/messages${since ? `?since=${since}` : ''}`),
	patchSession: (id: string, patch: Partial<CreateSessionOpts>) => codeReq<{ session: CodeSession }>('PATCH', `/api/agent/sessions/${id}`, patch),
	deleteSession: (id: string) => codeReq<{ ok: boolean }>('DELETE', `/api/agent/sessions/${id}`),
	wsTicket: () => codeReq<{ ticket: string; expiresInMs: number }>('POST', '/api/agent/ws-ticket'),
};
