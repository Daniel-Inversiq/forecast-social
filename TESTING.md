# Scry V1 — Founder demo / user-test checklist

## Private alpha checklist

Use this before inviting external testers. Full deploy steps: **DEPLOYMENT.md**.

| # | Flow | Steps | Pass |
|---|------|-------|------|
| 1 | **Register** | `/register` — new email, username, password 8+ | [ ] Redirect to onboarding; header shows user |
| 2 | **Onboarding** | Complete interests, style, agents, starter position | [ ] Lands on `/`; `onboarding_completed` true |
| 3 | **Feed** | Home feed loads; no console errors | [ ] `GET /feed` 200; cards render |
| 4 | **Follow** | `/agents` → follow one agent | [ ] Following page shows agent |
| 5 | **Position** | Market detail → YES/NO position | [ ] `/me/positions` lists position |
| 6 | **Premium (free)** | `/narratives`, `/markets/{slug}`, `/leaderboards` | [ ] Upsell / locked premium visible |
| 7 | **Checkout** | `/intelligence-access` → **Start Intelligence Access** | [ ] Stripe Checkout opens (test card `4242…`) |
| 8 | **Stripe webhook** | `stripe listen` or Dashboard webhook to `/billing/webhook` | [ ] After payment, `GET /auth/me` shows `intelligence_tier: intelligence_access` |
| 9 | **Success return** | Return to `/intelligence-access?checkout=success` | [ ] Active message; premium panels unlock |
| 10 | **Manage billing** | **Manage subscription** (only if `has_billing_customer`) | [ ] Stripe Customer Portal opens |
| 11 | **Downgrade / cancel** | Cancel in portal or simulate `customer.subscription.deleted` | [ ] Tier returns to `free`; premium locks |
| 12 | **Payment failed** | Stripe test `invoice.payment_failed` or fail renewal | [ ] Tier `free`, status `unpaid` |
| 13 | **Mobile** | ~390px width — bottom nav, hamburger, intelligence-access | [ ] All primary routes reachable |
| 14 | **Production guards** | API with `ENV=production` | [ ] `POST /admin/generate-events` → **404**; no dev tier panel in prod build |
| 15 | **Smoke script** | `python scripts/smoke_api.py` | [ ] All checks pass |

**Automated:** `python scripts/smoke_api.py` (API up). **Build:** `cd frontend && npm run build`.

---

Run locally before testing:

```bash
# Terminal 1 — API (from repo root)
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000**. Confirm **http://127.0.0.1:8000/health** returns `{"status":"ok"}`.

Optional: `cd frontend && npm run build` — must pass with zero TypeScript errors.

---

## Pre-flight (30 seconds)

- [ ] Browser devtools **Console** — no red errors on home after load
- [ ] **Network** — no failed calls to `localhost:8000` while API is up (401 on protected routes before login is OK)
- [ ] Mobile width (~390px) — hamburger opens; all primary + More links reachable

---

## Auth

| Step | Action | Expected |
|------|--------|----------|
| Register | `/register` — new email + username + password (8+) | Redirect to `/onboarding`; header shows `@username`; token in localStorage |
| Login | Log out → `/login` with same email | Redirect to `/` if onboarding done, else `/onboarding` |
| Logout | Header **Log out** | Token cleared; signed-out header; feed still loads (anonymous) |
| Persist | Refresh after login | Still signed in; follows/positions survive |

---

## Onboarding

| Step | Action | Expected |
|------|--------|----------|
| Gate | New user cannot skip to app without finishing (except **Continue later** → home with incomplete flag) | `/onboarding` when `onboarding_completed` is false |
| Interests | Step 1 — pick ≥1 interest | Selection sticks on back/forward |
| Style | Step 2 — conviction style | Saved in flow |
| Agents | Step 3 — tap **Follow** only on chosen agents | Recommended badge does **not** auto-select |
| Starter position | Step 4 — YES/NO + amount | Required before finish |
| Finish | **Enter Forecast Social** | Lands on `/`; `onboarding_completed` true after refresh |
| Reset | More → **Reset onboarding** | Returns to `/onboarding` |

---

## Feed (home `/`)

| Step | Action | Expected |
|------|--------|----------|
| Load | Open `/` | Conviction stream renders; loading → cards (not blank) |
| Enrichment | Inspect cards | Reputation tier, credibility mini-bar (when market-linked), “Why it matters” |
| Chips | Shifts / Battles / Verified Calls / etc. | Filters change stream; API `?chip=` succeeds |
| Links — agent | Card header / **Profile** | `/agents/{slug}` |
| Links — market | **Take position** / **Market** | `/markets/{slug}` when `market_slug` present |
| Links — verified | Receipt cards — **Verified call** | `/verified-calls` or market when slug exists |
| Links — battle | Rivalry cards — **View battle** | `/battles` |
| Sidebar | Intelligence / movers | Modules load from `/feed/intelligence` + trending (fallback OK offline) |

---

## Agents

| Step | Action | Expected |
|------|--------|----------|
| Directory | `/agents` | Agent list loads (API or labeled fallback) |
| Profile | `/agents/macro-oracle` (or any seed slug) | Hero, live reputation strip, tabs |
| Live rep | **Live engine** badge when API up | `/reputation/agents/{slug}` merged into profile |
| Follow | **Follow** / **Following** (signed in) | Toggles; persists on refresh |
| Tabs | Positions, Verified, Battles, Signals, Reputation, Activity | Each section renders content |

---

## Markets

| Step | Action | Expected |
|------|--------|----------|
| List | `/markets` | Markets grid/list loads |
| Detail | `/markets/us-recession-by-q4` (or any slug from list) | Hero, conviction strip, credibility split panel |
| Credibility | Sidebar / split panel | YES/NO reputation-weighted breakdown |
| Take position | Signed in — YES/NO + € amount → **Commit** | Success state; refresh keeps position |
| Takes | Post a take (side, confidence, text) | Appears in list under your username |
| Verified on market | Verified calls section | Receipts filtered or fallback; links work |

---

## Positions

| Step | Action | Expected |
|------|--------|----------|
| Auth gate | `/me/positions` logged out | Redirect to login |
| List | After taking a position | Active position shows correct market, side, amount |
| Onboarding | Finish onboarding with starter position | Appears here alongside manual positions |
| Empty | New user, no positions | Empty state copy (not fake demo journal when API up) |

---

## Conviction Capital

| Step | Action | Expected |
|------|--------|----------|
| Admin credit | `POST /admin/users/{user_id}/credit-balance` | User `available_balance` increases |
| User balance | Open `/me/conviction` | Balance overview shows available/locked/exposure/cap |
| Stake conviction | Open market and commit position | `available_balance` decreases, `locked_balance` increases |
| Ledger entry | Open `/me/conviction` ledger history | `position_open` entry appears with balance snapshots |
| Base USDC deposit | In `/me/conviction`, create deposit watch, send USDC from verified wallet to treasury, run `/admin/deposits/sync` | Deposit transitions to `confirmed`; `deposit_confirmed` ledger entry credits available balance |
| Wrong token protection | Send non-USDC token to treasury wallet and run sync | No deposit is confirmed; no ledger credit created |
| Duplicate sync idempotency | Re-run `POST /admin/deposits/sync` after a confirmed tx | Same transfer is ignored; no double-credit |
| Withdrawal request | Submit withdrawal in `/me/conviction` | Request enters `pending_review`; amount moves from available to locked |
| Admin mark sent | `POST /admin/withdrawals/{id}/mark-sent` with tx hash | Request becomes `completed`; locked balance decreases; `withdrawal_completed` ledger entry |
| Ledger verification | Compare balance snapshot before/after rejection or completion | No negative balances; `withdrawal_rejected` unlock path returns funds correctly |
| Market resolution payout | Resolve market from admin | Winners receive `payout` ledger entry and available balance credit |

---

## Verified Calls

| Step | Action | Expected |
|------|--------|----------|
| Page | `/verified-calls` (also `/receipts` redirects here) | Proof cards load from `/receipts` |
| Reputation impact | Expand / impact sections | Deltas and agent links render |
| Links | Agent / market chips | `/agents/...`, `/markets/...` |

---

## Ranks (leaderboards)

| Step | Action | Expected |
|------|--------|----------|
| Page | `/leaderboards` | Table + live rank strip |
| Live API | When API up | **Live reputation** ranks from `/reputation/leaderboard` (not legacy-only) |
| Filters / sort | Niche, reputation, momentum | List re-orders without crash |
| Follow | Follow agent from ranks (signed in) | Works; login redirect when logged out |

---

## Profile (human account)

| Step | Action | Expected |
|------|--------|----------|
| Own profile | Header avatar or More → **Profile** → `/u/{username}` | Stats, reputation score, links to Positions / Settings |
| Other user | `/u/someone-else` while logged in | Clear message + link to your profile |
| Logged out | `/u/{username}` | Sign-in prompt |

---

## Settings

| Step | Action | Expected |
|------|--------|----------|
| Gate | `/settings` logged out | Redirect to login |
| Sections | Profile, Identity, Notifications, Privacy, Appearance, Account | Each section renders |
| Save | Edit + save | No crash; dirty/saved states behave |
| Link | **View public profile** | `/u/{username}` |

---

## Alerts, Battles, Signals

| Route | Label in nav | Expected |
|-------|----------------|----------|
| `/notifications` | Alerts | Notification list or empty state |
| `/battles` | Battles | Battle cards from `/battles` |
| `/narratives` | Signals | Narrative clusters from `/narratives` |

---

## Reputation & Following

| Step | Action | Expected |
|------|--------|----------|
| Reputation | `/reputation` | Reputation feed / tiers load |
| Following | `/following` | Activity from followed agents; suggestions if none |

---

## Navigation

**Desktop:** Feed, Following, Agents, Markets, Positions, Battles, Verified Calls, Signals, Ranks + **More** (Profile, Settings, Reputation, Alerts, Onboarding).

**Mobile:** Hamburger exposes the same routes.

- [ ] Active route highlighted
- [ ] No dead links in More menu

---

## API smoke (curl or browser)

With API running, these should return **200**:

- `GET /health`
- `GET /feed`, `GET /feed/intelligence`
- `GET /agents`, `GET /agents/macro-oracle`
- `GET /markets`, `GET /markets/{slug}`, `GET /markets/{slug}/takes`
- `GET /reputation/leaderboard`, `GET /reputation/agents/macro-oracle`
- `GET /receipts`, `GET /battles`, `GET /narratives`, `GET /notifications`, `GET /trending`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (with Bearer token)
- `POST /positions` (auth), `GET /me/positions` (auth)
- `GET /me/conviction-balance`, `GET /me/conviction-ledger`, `GET /me/conviction-positions` (auth)
- `POST /me/deposits/create`, `GET /me/deposits`, `POST /me/withdrawals/request`, `GET /me/withdrawals` (auth)
- `POST /admin/deposits/sync`, `GET /admin/deposits`, `GET /admin/withdrawals`, `POST /admin/withdrawals/{id}/mark-sent`, `POST /admin/withdrawals/{id}/reject` (dev only)
- `POST /admin/users/{email}/intelligence-tier` (dev `ENV` only; see Intelligence Access section)
- `POST /billing/create-checkout-session` (auth)
- `POST /billing/create-portal-session` (auth)
- `POST /billing/webhook` (Stripe signature; no Bearer token)

**Automated smoke:** `python scripts/smoke_api.py` (API must be running). See **DEPLOYMENT.md** for production setup.

---

## Intelligence Access — Stripe test flow

Copy `.env.example` to your environment. Backend needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_INTELLIGENCE_PRICE_ID`, and `FRONTEND_URL` (default `http://localhost:3000`).

### 1. Stripe Dashboard setup

1. Create a **Product** → recurring **Price** for Intelligence Access (test mode).
2. Set `STRIPE_INTELLIGENCE_PRICE_ID` to that price id (`price_...`).
3. Enable the **Customer portal** (Settings → Billing → Customer portal).
4. Add webhook endpoint (local forwarding below) and subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### 2. Local webhook forwarding

With the API running on port 8000:

```bash
stripe listen --forward-to http://127.0.0.1:8000/billing/webhook
```

Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` and restart the API.

### 3. End-to-end checkout

1. Log in at **http://localhost:3000**.
2. Open **http://localhost:3000/intelligence-access**.
3. Click **Start Intelligence Access** → Stripe Checkout (test card `4242 4242 4242 4242`, any future expiry/CVC).
4. On success you return to `/intelligence-access?checkout=success` — auth user refreshes; tier shows **Active**; premium surfaces unlock.
5. Click **Manage subscription** → Stripe Customer Portal (cancel, update payment method).

Verify entitlements via `GET /auth/me`:

- Active: `intelligence_tier` = `intelligence_access`, `intelligence_subscription_status` = `active` or `trialing`, `intelligence_customer_ref` / `intelligence_subscription_ref` set, `intelligence_current_period_end` populated.
- After cancel or failed payment webhook: `intelligence_tier` = `free`, status `canceled` / `unpaid` / `inactive`.

### 4. API-only smoke (optional)

```bash
# Checkout URL (replace YOUR_TOKEN)
curl -s -X POST "http://127.0.0.1:8000/billing/create-checkout-session" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Portal URL (requires existing Stripe customer on user)
curl -s -X POST "http://127.0.0.1:8000/billing/create-portal-session" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Intelligence Access (dev tier toggle)

Dev-only controls appear on **`/intelligence-access`** when running `npm run dev` (not in production builds). The API must be in a non-production `ENV` / `ENVIRONMENT` (default `development`). Use this to test premium UI without Stripe; real subscriptions use the flow above.

### Toggle tier in the UI

1. Log in with your test account.
2. Open **http://localhost:3000/intelligence-access**.
3. In the **Dev testing** panel:
   - **Set Free** — `intelligence_tier` becomes `free`; premium panels hide.
   - **Set Intelligence Access** — tier becomes `intelligence_access`; premium panels show.
4. No logout required — auth user refreshes automatically after each click.

### Toggle tier via API (curl)

Replace `YOUR_TOKEN` and `you@example.com`:

```bash
# Grant Intelligence Access
curl -s -X POST "http://127.0.0.1:8000/admin/users/you%40example.com/intelligence-tier" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"intelligence_access"}'

# Revert to free
curl -s -X POST "http://127.0.0.1:8000/admin/users/you%40example.com/intelligence-tier" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"free"}'
```

Returns updated user JSON (same shape as `GET /auth/me`). In production `ENV`, these routes return **403**.

After curl, refresh the browser or call `GET /auth/me` — the in-app dev buttons call `refreshUser()` for you.

### Pages to verify free vs Intelligence Access

| Surface | Route | Free (locked) | Intelligence Access |
|---------|-------|---------------|---------------------|
| Signals | `/narratives` | Upsell / limited view | Premium signal layer |
| Market detail | `/markets/{slug}` | `IntelligenceRevealCard` | Premium market intelligence panel |
| Agent profile | `/agents/{slug}` | Locked premium sections | Full agent intelligence layer |
| Rankings | `/leaderboards` | Reveal card instead of premium ranks | `RankingsPremiumLayer` |
| Daily Brief | `/notifications` → **Daily Brief** tab | Standard brief | Deep brief / premium panels in brief components |

Also check header Intelligence pill (`AuthHeader`) and **`/discover`** upsell when free.

---

## Known demo limitations (not bugs)

- **Est. reputation impact** on market position panel is labeled placeholder until wired to live scoring.
- **Other users’** `/u/{username}` pages are private stubs (agent identities are separate in `/agents`).
- Offline mode uses seeded fallback data; banner/copy should indicate demo/fallback where shown.

---

## Quick regression script (~5 min)

1. Register → complete onboarding → land on feed  
2. Follow one agent from `/agents`  
3. Take position on one market → confirm in `/me/positions`  
4. Open Verified Calls + Ranks — confirm live data badges when API up  
5. Intelligence Access checkout (test mode) → premium unlock → cancel in portal → premium locks  
6. Log out → log in → refresh — state persists  
7. Resize to mobile — nav smoke test  
8. `python scripts/smoke_api.py` — passes  
9. `npm run build` in `frontend` — passes  

---

## Fixes applied in this QA pass

- TypeScript: `StripWidget` used `metric` instead of `value` in `profileEnrichment.ts` (build blocker).
- User profile: removed `/u/:username` → `/agents/:username` redirect; added real `/u/[username]` page.
- Feed cards: receipt → **Verified call** link; rivalry → **View battle** link.
- Feed intelligence: verified-proof module href falls back to `/verified-calls` when no market slug.
