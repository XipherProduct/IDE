// Per-session publish/subscribe fan-out for live streaming.
//
// A single running turn (agentLoop) publishes frames to a session's channel; any
// number of subscribers — the browser that started it, a second browser tab, the
// desktop IDE mirroring the session — receive them. This is what lets a session
// be "written to from the web while active" and mirrored elsewhere.
//
// Ownership is enforced by the caller (agentApi resolves userId from the verified
// transport, then checks getSession before subscribing), but subscribe() also
// re-checks so a channel can never be joined for a session the user doesn't own.

import { EventEmitter } from 'node:events';
import { getSession } from './agentStore.mjs';

const channels = new Map(); // sessionId -> { emitter, running }

function chan(sessionId) {
	let c = channels.get(sessionId);
	if (!c) {
		const emitter = new EventEmitter();
		emitter.setMaxListeners(0);
		c = { emitter, running: false };
		channels.set(sessionId, c);
	}
	return c;
}

// Subscribe to a session's live frames. Returns an unsubscribe fn, or null if the
// user doesn't own the session. `onFrame(frame)` receives every published frame.
export function subscribe(userId, sessionId, onFrame) {
	if (!getSession(userId, sessionId)) { return null; }
	const c = chan(sessionId);
	c.emitter.on('frame', onFrame);
	return () => {
		c.emitter.off('frame', onFrame);
		// drop the channel once idle to avoid unbounded growth
		if (!c.running && c.emitter.listenerCount('frame') === 0) { channels.delete(sessionId); }
	};
}

// Publish a frame to all subscribers of a session. Called only by the turn owner
// (agentLoop), which already holds the session lock — no ownership arg needed.
export function publish(sessionId, frame) {
	const c = channels.get(sessionId);
	if (c) { c.emitter.emit('frame', frame); }
}

// Mark a session's turn as running / idle so the channel isn't GC'd mid-turn and
// so a late subscriber can learn a turn is in flight.
export function setRunning(sessionId, running) { chan(sessionId).running = running; }
export function isRunning(sessionId) { return !!(channels.get(sessionId)?.running); }

// Control-channel: cancellation signalled from a client frame reaches the running
// turn. The turn registers a canceller; cancel() invokes it.
const cancellers = new Map(); // sessionId -> fn
export function registerCanceller(sessionId, fn) { cancellers.set(sessionId, fn); }
export function clearCanceller(sessionId) { cancellers.delete(sessionId); }
export function cancel(sessionId) {
	const fn = cancellers.get(sessionId);
	if (fn) { try { fn(); } catch { /* ignore */ } return true; }
	return false;
}

// ---- approval round-trip (announce_plan / tool permission) ------------------
//
// The turn publishes an `awaiting_approval` activity, then awaits a client
// `approve_plan` / `tool_permission` control frame keyed by callId. Fail-closed:
// if no client answers within the timeout (or nobody is subscribed), the promise
// resolves to { approved:false, reason:'timeout' } — a headless run never
// auto-approves a mutating/egress action.

const pendingApprovals = new Map(); // `${sessionId}:${callId}` -> resolve fn

export function awaitApproval(sessionId, callId, timeoutMs = 5 * 60_000) {
	const key = `${sessionId}:${callId}`;
	return new Promise(resolve => {
		let settled = false;
		const done = v => { if (!settled) { settled = true; pendingApprovals.delete(key); clearTimeout(t); resolve(v); } };
		const t = setTimeout(() => done({ approved: false, reason: 'timeout' }), timeoutMs);
		pendingApprovals.set(key, done);
	});
}

// Deliver a client's approval decision to the waiting turn. Returns true if a
// turn was waiting for this callId.
export function provideApproval(sessionId, callId, decision) {
	const key = `${sessionId}:${callId}`;
	const done = pendingApprovals.get(key);
	if (done) { done(decision); return true; }
	return false;
}
