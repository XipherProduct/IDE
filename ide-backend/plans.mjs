// Plans / tiers, per-model credit multipliers, and rolling-window credit limits.
//
// All models are "paid"; tiers grant access. Free unlocks only the cheap models;
// Trial unlocks everything for a period; Pro/Max scale the limits.
// A request costs `1 credit × model.multiplier`. Two rolling windows are
// enforced: a 5-hour burst window and a 7-day window.

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USAGE_PATH = path.join(DATA_DIR, 'usage.json');

const HOUR = 3600_000;
const WINDOW_5H = 5 * HOUR;
const WINDOW_WEEK = 7 * 24 * HOUR;

// tier order (index = rank); a model with minTier=pro needs rank >= pro
export const TIER_RANK = { free: 0, trial: 1, pro: 2, maxx5: 3, maxx10: 4 };

export const PLANS = {
	free:   { id: 'free',   label: 'Free',     credits5h: 25,   creditsWeek: 150,   allModels: false, webSearchDaily: 50,   webFetchDaily: 200 },
	trial:  { id: 'trial',  label: 'Trial',    credits5h: 200,  creditsWeek: 1000,  allModels: true,  trialDays: 7, webSearchDaily: 300, webFetchDaily: 1000 },
	pro:    { id: 'pro',    label: 'Pro',      credits5h: 300,  creditsWeek: 1000,  allModels: true,  webSearchDaily: 300,  webFetchDaily: 1000 },
	maxx5:  { id: 'maxx5',  label: 'Max ×5',   credits5h: 1500, creditsWeek: 5000,  allModels: true,  webSearchDaily: 1000, webFetchDaily: 3000 },
	maxx10: { id: 'maxx10', label: 'Max ×10',  credits5h: 3000, creditsWeek: 10000, allModels: true,  webSearchDaily: 2000, webFetchDaily: 6000 },
};

// The site's top tier is maxx20, but the IDE tier list tops out at maxx10.
// Map any site-only plan id to its nearest IDE tier so plan lookups (model
// access, quotas) don't silently fall back to `free`.
const PLAN_ALIAS = { maxx20: 'maxx10' };
export function planOf(id) { return PLANS[id] || PLANS[PLAN_ALIAS[id]] || PLANS.free; }

// Daily web-tool quotas per plan (search + fetch), used by web.mjs.
export function webQuotaOf(id) {
	const p = planOf(id);
	return { search: p.webSearchDaily ?? 50, fetch: p.webFetchDaily ?? 200 };
}

// A model is allowed if the plan unlocks all models, or the model's minTier
// rank is <= the plan's rank (free models are always allowed).
export function modelAllowed(planId, model) {
	const plan = planOf(planId);
	if (plan.allModels) return true;
	return TIER_RANK[model.minTier || 'free'] <= TIER_RANK[plan.id];
}

// ---- rolling usage store (persisted) ---------------------------------------

let usage = {}; // userId -> [{ ts, credits }]
function load() { try { usage = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')); } catch { usage = {}; } }
function save() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	const tmp = USAGE_PATH + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(usage));
	fs.renameSync(tmp, USAGE_PATH);
}
load();

function prune(list, now) { return list.filter(e => now - e.ts < WINDOW_WEEK); }

function sums(userId) {
	const now = Date.now();
	const list = prune(usage[userId] || [], now);
	usage[userId] = list;
	let c5 = 0, cw = 0;
	for (const e of list) { if (now - e.ts < WINDOW_5H) c5 += e.credits; cw += e.credits; }
	return { c5, cw, now };
}

// Snapshot for /api/ai/usage and /api/me/quota
export function usageSnapshot(userId, planId) {
	const plan = planOf(planId);
	const { c5, cw } = sums(userId);
	return {
		plan: plan.id, plan_label: plan.label,
		credits5h_used: round(c5), credits5h_limit: plan.credits5h,
		creditsWeek_used: round(cw), creditsWeek_limit: plan.creditsWeek,
	};
}

// Can the user afford `cost` credits within both windows right now?
export function canAfford(userId, planId, cost) {
	const plan = planOf(planId);
	const { c5, cw } = sums(userId);
	if (c5 + cost > plan.credits5h) return { ok: false, window: '5h', reset_in_s: resetIn(userId, WINDOW_5H) };
	if (cw + cost > plan.creditsWeek) return { ok: false, window: 'week', reset_in_s: resetIn(userId, WINDOW_WEEK) };
	return { ok: true };
}

export function charge(userId, cost) {
	if (!usage[userId]) usage[userId] = [];
	usage[userId].push({ ts: Date.now(), credits: cost });
	save();
}

function resetIn(userId, windowMs) {
	const list = usage[userId] || [];
	if (!list.length) return 0;
	const oldest = Math.min(...list.map(e => e.ts));
	return Math.max(0, Math.round((oldest + windowMs - Date.now()) / 1000));
}
function round(n) { return Math.round(n * 100) / 100; }
