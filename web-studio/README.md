# Xipher Studio — site (React + Vite + TS) + backend

The marketing/account site "in the form of an IDE", rebuilt from `web/newsite/Studio.html`
as a real React app, plus a zero-dep Node backend for accounts, tariffs, referrals and admin.

## Layout
- `web-studio/` — Vite + React + TypeScript frontend (this dir).
- `../site-backend/` — Node (zero deps) API: accounts, tariffs, referrals, admin.

## Run (dev)
```bash
# 1) backend  (port 8098)
cd site-backend
ADMIN_TOKEN=devtoken ADMIN_EMAIL=you@example.com node server.mjs

# 2) frontend (port 5173, proxies /api → :8098)
cd web-studio
npm install
npm run dev          # open http://localhost:5173
```
Data persists to `site-backend/data/site.json` (atomic writes). `npm test` in
`site-backend/` runs the 23-check end-to-end suite.

## Tariffs (RUB)
| Tier | Price | Quota | Note |
|------|------:|-------|------|
| Pro | 999 ₽/mo | 300 cr/5h · 2000 cr/wk | unit tier |
| Max ×5 | 4245 ₽/mo | 5× Pro | −15% vs 5 Pro |
| Max ×20 | 15984 ₽/mo | 20× Pro | −20% vs 20 Pro |
| Pro Trial | 49 ₽ / 7d | = Pro | **referral-only** |

Credits: `1 request × model multiplier`, enforced over two rolling windows (5h + 7d).

## Referrals
Only a **paid** user gets a shareable link (`/#/r/<CODE>`). Redeeming it buys **Pro for
7 days at 49 ₽** (`trial` tier). Anti-abuse: one redemption per user, no self-referral,
inviter must currently be paid, redeemer must not already be paid. Rate-limited by IP.

## Security
- Passwords: **scrypt** (per-user salt), constant-time verify.
- Sessions: 256-bit bearer tokens, stored **hashed** (sha256), 30-day TTL.
- Rate limiting: register / login / redeem (sliding window per IP).
- Input validation (email, password strength), payload caps, CORS allow-list.
- Admin gated by `ADMIN_TOKEN` env **or** a logged-in `isAdmin` user; `ADMIN_EMAIL`
  auto-promotes on boot.

## Client pages
`/` home · `/pricing` tariffs+checkout · `/login` `/register` · `/dashboard`
(plan, usage meters, referral link) · `/r/<code>` redeem · `/admin` (users, revenue,
set-plan). Routing is hash-based ("files" in the IDE tree).

## Payments
`billing.pay()` is a mock ledger — slot a real PSP (YooKassa/Stripe) in there; the
purchase records and plan grants already flow through it.
