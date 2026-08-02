// Xipher site — tariffs, credit limits, and referral economics.
//
// Money is in RUB (integer rubles). Quotas are "credits": 1 credit ≈ 1 request ×
// model multiplier. Two rolling windows are enforced everywhere: a 5-hour burst
// window and a 7-day window (see usage.mjs).
//
// Pricing rules (from product spec):
//   Pro       — 999 ₽ / month, the unit tier.
//   Max ×5    — 5× Pro quota, priced 15% below 5 Pros  → 5·999·0.85 = 4245 ₽.
//   Max ×20   — 20× Pro quota, priced 20% below 20 Pros → 20·999·0.80 = 15984 ₽.
//   Ref trial — Pro for 7 days for 49 ₽, only redeemable via a paid user's link.

export const PRO_MONTH_RUB = 999;

function discounted(units, off) {
	// floor to a whole ruble so the headline price stays clean (4245, not 4245.75)
	return Math.floor(PRO_MONTH_RUB * units * (1 - off));
}

// tier rank — a model with minTier=pro needs rank >= pro
export const TIER_RANK = { free: 0, trial: 1, pro: 2, maxx5: 3, maxx20: 4 };

// Base Pro quota; higher tiers scale linearly by their ×factor.
const PRO_5H = 300;
const PRO_WEEK = 2000;

export const PLANS = {
	free: {
		id: 'free', label: 'Free', factor: 0,
		priceRub: 0, periodDays: 30,
		credits5h: 25, creditsWeek: 150,
		allModels: false,
		blurb: 'Попробовать без карты — дешёвые модели.',
	},
	trial: {
		id: 'trial', label: 'Pro Trial', factor: 1,
		priceRub: 49, periodDays: 7, referralOnly: true,
		credits5h: PRO_5H, creditsWeek: PRO_WEEK,
		allModels: true,
		blurb: '7 дней Pro по реф-ссылке за 49 ₽.',
	},
	pro: {
		id: 'pro', label: 'Pro', factor: 1,
		priceRub: PRO_MONTH_RUB, periodDays: 30,
		credits5h: PRO_5H, creditsWeek: PRO_WEEK,
		allModels: true,
		blurb: 'Все модели, полный агент, перенос кредитов.',
	},
	maxx5: {
		id: 'maxx5', label: 'Max ×5', factor: 5,
		priceRub: discounted(5, 0.15), periodDays: 30, saveHint: '−15%',
		credits5h: PRO_5H * 5, creditsWeek: PRO_WEEK * 5,
		allModels: true,
		blurb: '5× квота Pro, на 15% выгоднее пяти Pro.',
	},
	maxx20: {
		id: 'maxx20', label: 'Max ×20', factor: 20,
		priceRub: discounted(20, 0.20), periodDays: 30, saveHint: '−20%',
		credits5h: PRO_5H * 20, creditsWeek: PRO_WEEK * 20,
		allModels: true,
		blurb: '20× квота Pro для команд, на 20% выгоднее.',
	},
};

// Tiers a customer can buy directly (Free is default; trial is referral-only).
export const PURCHASABLE = ['pro', 'maxx5', 'maxx20'];

export function planOf(id) { return PLANS[id] || PLANS.free; }

export function isPaidTier(id) {
	return id === 'pro' || id === 'maxx5' || id === 'maxx20' || id === 'trial';
}

// A model is allowed if the plan unlocks all models, or the model's minTier rank
// is <= the plan's rank (free models are always allowed).
export function modelAllowed(planId, model) {
	const plan = planOf(planId);
	if (plan.allModels) { return true; }
	return (TIER_RANK[model.minTier || 'free'] ?? 0) <= (TIER_RANK[plan.id] ?? 0);
}

// ---- add-ons & billing options -------------------------------------------

// Yearly billing: pay for 12 months up front at a discount.
export const ANNUAL_DISCOUNT = 0.20;
export function annualPrice(planId) {
	const p = planOf(planId);
	if (!p.priceRub) { return 0; }
	return Math.floor(p.priceRub * 12 * (1 - ANNUAL_DISCOUNT));
}

// À-la-carte credit packs — a persistent bonus pool on top of the plan windows.
// Bigger packs carry more bonus (better ₽/credit).
export const CREDIT_PACKS = [
	{ id: 'cr_s', label: 'Малый', credits: 500, priceRub: 249 },
	{ id: 'cr_m', label: 'Средний', credits: 1500, priceRub: 649 },
	{ id: 'cr_l', label: 'Большой', credits: 4000, priceRub: 1490 },
	{ id: 'cr_xl', label: 'Мега', credits: 10000, priceRub: 2990 },
];
export function creditPack(id) { return CREDIT_PACKS.find(p => p.id === id) || null; }

// Wallet top-up quick amounts (₽). Any custom amount within bounds is allowed.
export const TOPUP_PRESETS = [200, 500, 1000, 2000, 5000];
export const TOPUP_MIN = 100;
export const TOPUP_MAX = 100000;

// A paid referral redemption pays the inviter this much wallet credit (₽).
export const REFERRAL_REWARD_RUB = 25;

export function creditPackCatalog() {
	return CREDIT_PACKS.map(p => ({ ...p, perCredit: Math.round((p.priceRub / p.credits) * 100) / 100 }));
}

// Public catalog for the pricing page.
export function pricingCatalog() {
	return PURCHASABLE.map(id => {
		const p = PLANS[id];
		return {
			id: p.id,
			label: p.label,
			priceRub: p.priceRub,
			annualRub: annualPrice(id),
			annualMonthlyRub: Math.round(annualPrice(id) / 12),
			periodDays: p.periodDays,
			factor: p.factor,
			saveHint: p.saveHint || null,
			credits5h: p.credits5h,
			creditsWeek: p.creditsWeek,
			blurb: p.blurb,
			perProEquivalent: id === 'pro' ? null : Math.round(p.priceRub / p.factor),
		};
	});
}
