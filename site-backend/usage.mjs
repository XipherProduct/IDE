// Rolling credit windows (5-hour burst + 7-day) over persisted usage events.

import { db, save } from './db.mjs';
import { planOf } from './plans.mjs';
import { getUser } from './users.mjs';

const HOUR = 3600_000;
export const WINDOW_5H = 5 * HOUR;
export const WINDOW_WEEK = 7 * 24 * HOUR;

function round(n) { return Math.round(n * 100) / 100; }

function prune(list, now) { return list.filter(e => now - e.ts < WINDOW_WEEK); }

function sums(userId) {
	const store = db();
	const now = Date.now();
	const list = prune(store.usage[userId] || [], now);
	store.usage[userId] = list;
	let c5 = 0, cw = 0;
	for (const e of list) {
		if (now - e.ts < WINDOW_5H) { c5 += e.credits; }
		cw += e.credits;
	}
	return { c5, cw, now };
}

function resetIn(userId, windowMs) {
	const list = db().usage[userId] || [];
	if (!list.length) { return 0; }
	const oldest = Math.min(...list.map(e => e.ts));
	return Math.max(0, Math.round((oldest + windowMs - Date.now()) / 1000));
}

export function usageSnapshot(userId, planId) {
	const plan = planOf(planId);
	const { c5, cw } = sums(userId);
	const bonus = getUser(userId)?.bonusCredits || 0;
	return {
		plan: plan.id,
		plan_label: plan.label,
		credits5h_used: round(c5),
		credits5h_limit: plan.credits5h,
		creditsWeek_used: round(cw),
		creditsWeek_limit: plan.creditsWeek,
		creditsWeek_effective_limit: plan.creditsWeek + bonus, // plan window + add-on pool
		bonusCredits: bonus,
		credits5h_reset_s: c5 > 0 ? resetIn(userId, WINDOW_5H) : 0,
		creditsWeek_reset_s: cw > 0 ? resetIn(userId, WINDOW_WEEK) : 0,
	};
}

export function canAfford(userId, planId, cost) {
	const plan = planOf(planId);
	const { c5, cw } = sums(userId);
	if (c5 + cost > plan.credits5h) { return { ok: false, window: '5h', reset_in_s: resetIn(userId, WINDOW_5H) }; }
	if (cw + cost > plan.creditsWeek) { return { ok: false, window: 'week', reset_in_s: resetIn(userId, WINDOW_WEEK) }; }
	return { ok: true };
}

export function charge(userId, cost, model) {
	const store = db();
	if (!store.usage[userId]) { store.usage[userId] = []; }
	store.usage[userId].push({ ts: Date.now(), credits: cost, model: model || null });
	save();
}

// Per-day activity for the dashboard heatmap. "Activity" = anything the user did
// that day: credits spent + billing events (purchases, top-ups, wallet moves).
// Returns a dense array of the last `days` days (oldest→newest).
export function activityByDay(userId, days = 119) {
	const store = db();
	const DAY = 86400_000;
	const now = new Date();
	// normalize to local midnight
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const start = today - (days - 1) * DAY;
	const key = ts => {
		const d = new Date(ts);
		return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	};
	const map = new Map(); // dayTs -> { credits, requests, events }
	const bump = (ts, { credits = 0, requests = 0, events = 0 }) => {
		const k = key(ts);
		if (k < start || k > today) { return; }
		const cur = map.get(k) || { credits: 0, requests: 0, events: 0 };
		cur.credits += credits; cur.requests += requests; cur.events += events;
		map.set(k, cur);
	};
	for (const e of store.usage[userId] || []) { bump(e.ts, { credits: e.credits || 0, requests: 1, events: 1 }); }
	for (const inv of store.invoices || []) { if (inv.userId === userId && inv.status === 'paid') { bump(inv.ts, { events: 1 }); } }
	for (const t of store.balanceTx || []) { if (t.userId === userId) { bump(t.ts, { events: 1 }); } }

	const out = [];
	let totalCredits = 0, totalRequests = 0, activeDays = 0, streak = 0, best = 0;
	for (let i = 0; i < days; i++) {
		const k = start + i * DAY;
		const v = map.get(k) || { credits: 0, requests: 0, events: 0 };
		const level = v.events === 0 ? 0 : v.credits >= 50 || v.events >= 8 ? 4 : v.credits >= 20 || v.events >= 4 ? 3 : v.credits >= 5 || v.events >= 2 ? 2 : 1;
		out.push({ date: new Date(k).toISOString().slice(0, 10), credits: round(v.credits), requests: v.requests, events: v.events, level });
		totalCredits += v.credits; totalRequests += v.requests;
		if (v.events > 0) { activeDays++; streak++; best = Math.max(best, streak); } else { streak = 0; }
	}
	// current streak = trailing run of active days
	let curStreak = 0;
	for (let i = out.length - 1; i >= 0 && out[i].events > 0; i--) { curStreak++; }
	return { days: out, totalCredits: round(totalCredits), totalRequests, activeDays, bestStreak: best, currentStreak: curStreak, windowDays: days };
}
