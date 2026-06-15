# Scry — Private Alpha Deployment

This guide covers deploying Scry for a **private alpha** (invite-only testers). It assumes no new product features—only the existing API, Next.js frontend, SQLite (or optional Postgres URL), and Stripe Intelligence Access billing.

---

## Architecture

| Component | Default | Notes |
|-----------|---------|--------|
| API | FastAPI + Uvicorn | `backend/` |
| Frontend | Next.js 16 | `frontend/` |
| Database | SQLite file | Set `DATABASE_URL` for hosted Postgres when ready |
| Billing | Stripe Checkout + Customer Portal + webhooks | Intelligence Access only |

---

## 1. Local development

```bash
# Terminal 1 — API
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
# Copy backend/.env.example → .env and adjust
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
# Copy frontend/.env.example → .env.local
npm run dev
```

Open **http://localhost:3000**. Health: **http://127.0.0.1:8000/health**.

**Demo content (first time):**

```bash
cd backend
python -m app.forecasting.seed
```

Destructive seed is **blocked** when `ENV=production` unless `ALLOW_SEED=1` is set intentionally.

**Stripe webhooks locally:**

```bash
stripe listen --forward-to http://127.0.0.1:8000/billing/webhook
```

Set `STRIPE_WEBHOOK_SECRET` from the CLI output and restart the API.

---

## 2. Environment variables

### Backend (required for production)

| Variable | Required | Description |
|----------|----------|-------------|
| `ENV` | Yes | Set to `production` (or `prod`) |
| `JWT_SECRET` | Yes | 32+ random characters; **no default allowed in prod** |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default `120` (2h). Increase only if product needs longer sessions; shorter is safer for beta. |
| `FRONTEND_URL` | Yes | Canonical app URL, e.g. `https://app.scry.example` |
| `STRIPE_SECRET_KEY` | Yes | Live or test secret (`sk_live_…` / `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | From Stripe Dashboard or `stripe listen` |
| `STRIPE_INTELLIGENCE_PRICE_ID` | Yes | Recurring price id (`price_…`) |
| `DATABASE_URL` | No | Default `sqlite:///./forecast_social.db` |
| `CORS_EXTRA_ORIGINS` | No | Comma-separated preview/staging origins |
| `ENABLE_EVENT_SCHEDULER` | No | **Leave unset in production** — synthetic events are dev-only |
| `BASE_RPC_URL` | Yes (Phase 3A) | Base JSON-RPC endpoint used by deposit scanner |
| `POLYGON_RPC_URL` | Optional | Polygon JSON-RPC endpoint for next-chain rollout |
| `USDC_BASE_CONTRACT` | Yes (Phase 3A) | USDC contract on Base |
| `USDC_POLYGON_CONTRACT` | Optional | USDC contract on Polygon |
| `TREASURY_WALLET_ADDRESS` | Yes (Phase 3A) | Treasury destination wallet for user deposits |
| `MIN_DEPOSIT_USDC` | No | Minimum detected USDC amount (default `5`) |
| `MAX_USER_EXPOSURE_USDC` | No | Per-user conviction cap (default `100`) |
| `MAX_MARKET_EXPOSURE_USDC` | No | Per-market conviction cap (default `25`) |

| `SENTRY_DSN` | No | Error monitoring; enabled in production when set. Off in local dev unless `SENTRY_ENABLED=true` |
| `SENTRY_ENABLED` | No | Force Sentry on/off |
| `SENTRY_TRACES_SAMPLE_RATE` | No | Default `0.1` in production |

See `backend/.env.example` for the full list. See [`docs/SENTRY.md`](docs/SENTRY.md) for setup and test events.

### Frontend (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL, e.g. `https://api.scry.example` |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN; reporting on in production builds when set |
| `NEXT_PUBLIC_SENTRY_ENABLED` | No | Override for local/staging (`true` / `false`) |

Set in the host’s build environment (Vercel, etc.). See `frontend/.env.example` and [`docs/SENTRY.md`](docs/SENTRY.md).

---

## 3. Backend deploy steps

1. **Set production env** on the host (`ENV=production`, strong `JWT_SECRET`, Stripe vars, `FRONTEND_URL`).
2. **Install dependencies:** `pip install -r backend/requirements.txt`
3. **Run migrations** — on first boot, `migrate_schema()` runs automatically via FastAPI lifespan. For multi-instance deploys, run a single instance first or extract migrations to a one-off job.
4. **Seed demo roster (one time, alpha):**  
   `ALLOW_SEED=1 python -m app.forecasting.seed`  
   Only if you need agents/markets; skip if restoring from backup.
5. **Start API:**  
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`  
   (Use a process manager: systemd, Fly, Railway, Render, etc.)
6. **Verify:** `curl https://api.example/health` → `{"status":"ok"}`

### Phase 3A scanner notes

- Deposit detection is intentionally Base-first and USDC-only.
- Sync uses `POST /admin/deposits/sync` (dev/admin route) and is idempotent per `tx_hash + log_index`.
- Credits are applied only when transfer sender is a verified, linked wallet and transfer amount meets `MIN_DEPOSIT_USDC`.
- Withdrawals remain manual: users create requests, admins mark sent or reject.

### Production safety (built in)

- Admin routes (`/admin/*`) are **not registered** when `ENV=production`.
- Startup **exits** if `JWT_SECRET` is missing, too short, or still the dev default.
- CORS `allow_origins` is driven by `FRONTEND_URL` + `CORS_EXTRA_ORIGINS` (localhost allowed only in non-production).
- Event scheduler never runs when `ENV=production`.
- Destructive `seed()` refuses to run in production without `ALLOW_SEED=1`.

---

## 4. Frontend deploy steps

1. Set `NEXT_PUBLIC_API_URL` to your production API.
2. Build: `cd frontend && npm ci && npm run build`
3. Deploy `.next` output (Vercel recommended) or `npm run start` behind HTTPS.
4. Confirm `FRONTEND_URL` on the API matches the deployed frontend origin (Stripe redirects + CORS).

---

## 5. Stripe webhook setup

1. Stripe Dashboard → **Developers → Webhooks** → Add endpoint:  
   `https://api.example/billing/webhook`
2. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` on the API.
4. Enable **Customer portal** (Settings → Billing → Customer portal).
5. Create product + recurring price → `STRIPE_INTELLIGENCE_PRICE_ID`.

Webhook signature verification and idempotency (`processed_stripe_events` table) are implemented in `backend/app/billing/routes.py`.

---

## 6. Smoke tests

With API running:

```bash
python scripts/smoke_api.py
# or
API_BASE=https://api.example python scripts/smoke_api.py
```

Manual checks: see **TESTING.md** (private alpha checklist).

---

## 7. Production checklist

- [ ] `ENV=production` on API
- [ ] `JWT_SECRET` — 32+ chars, unique, not committed
- [ ] `FRONTEND_URL` matches live app URL (HTTPS)
- [ ] `NEXT_PUBLIC_API_URL` points to live API (HTTPS)
- [ ] CORS: `FRONTEND_URL` set; add previews via `CORS_EXTRA_ORIGINS` if needed
- [ ] Stripe live/test keys and webhook secret configured
- [ ] Webhook endpoint reachable from Stripe (no auth header)
- [ ] Customer portal enabled in Stripe
- [ ] `ENABLE_EVENT_SCHEDULER` **unset** in production
- [ ] Admin routes return 404 (not mounted) — verify `POST /admin/generate-events` → 404
- [ ] Dev tier UI not visible in production build (`npm run build` + deploy)
- [ ] `python scripts/smoke_api.py` passes against production API
- [ ] `npm run build` passes in `frontend/`
- [ ] Database backed up (`forecast_social.db` or managed Postgres)
- [ ] HTTPS on frontend and API

---

## 8. Rollback notes

| Change | Rollback |
|--------|----------|
| Bad API deploy | Redeploy previous container/image; DB schema is forward-only—avoid downgrading code that expects newer columns |
| Bad frontend deploy | Redeploy previous Vercel/host build; env vars are per-deployment |
| Stripe misconfiguration | Disable webhook in Dashboard; fix env vars; replay events from Stripe Dashboard if needed |
| Bad seed | Restore DB backup; do **not** re-run `seed()` on production without `ALLOW_SEED=1` |
| Entitlement mistakes | Fix via Stripe Customer Portal or Stripe Dashboard subscription state; webhooks will sync tier |

**JWT secret rotation:** Changing `JWT_SECRET` invalidates all sessions; users must log in again.

---

## 9. Known alpha limitations

- SQLite is fine for a small private alpha; plan Postgres + migration tooling before scaling.
- SSE (`/feed/stream`) does not send Bearer tokens; feed personalization for logged-in users over SSE is limited.
- JWTs are stored in `localStorage` (standard for this stack; XSS hygiene matters).

For QA flows, see **TESTING.md**.
