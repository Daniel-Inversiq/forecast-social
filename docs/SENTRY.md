# Sentry — error monitoring for SCRY

Sentry is integrated on the **Next.js frontend** and **FastAPI backend**. It is **disabled in local development by default** and turns on in production when a DSN is configured.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | For reporting | _(empty)_ | Project DSN from [sentry.io](https://sentry.io) |
| `SENTRY_ENABLED` | No | auto | `true` / `false` override. In `ENV=development`, Sentry stays **off** unless `SENTRY_ENABLED=true` |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` in prod | Performance trace sampling (`0`–`1`) |
| `SENTRY_DEBUG_ROUTES` | No | off | `true` exposes `/debug/sentry-test` and `/debug/sentry-throw` |

`ENV` / `ENVIRONMENT` is sent as the Sentry **environment** tag (e.g. `production`, `development`).

### Frontend (`frontend/.env.local` / build env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | For reporting | _(empty)_ | Browser + server DSN (public) |
| `NEXT_PUBLIC_SENTRY_ENABLED` | No | auto | `true` / `false` override for local testing |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | No | `VERCEL_ENV` / `NODE_ENV` | Sentry environment name |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Client/server trace sampling |
| `NEXT_PUBLIC_SENTRY_DEBUG_ROUTES` | No | off | `true` enables `/sentry-test` page |
| `SENTRY_ORG` | No | — | Optional: Sentry org slug for source map upload |
| `SENTRY_PROJECT` | No | — | Optional: Sentry project slug for source map upload |

## What gets captured

| Signal | Frontend | Backend |
|--------|----------|---------|
| Unhandled exceptions | Yes (`error.tsx`, `global-error.tsx`) | Yes (FastAPI integration) |
| Client errors | Yes | — |
| Route / path | `route` tag (`usePathname`) | `route` tag (request path) |
| Environment | `environment` tag | `environment` tag (`ENV`) |
| User id | When signed in (`AuthProvider`) | From `Authorization: Bearer` JWT when present |
| Background jobs | — | `event_generation_loop` failures |
| API 5xx | — | Unhandled exceptions + middleware |

## What is ignored

- **422** request validation (`RequestValidationError`, Pydantic `ValidationError`)
- **404** HTTP exceptions and Next.js `NEXT_NOT_FOUND` / 404 digests
- `/health` probe noise (backend `before_send`)
- Common benign client aborts (`AbortError`)

## Enable locally (optional)

```bash
# Backend
cd backend
# .env
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENABLED=true
SENTRY_DEBUG_ROUTES=true

# Frontend — frontend/.env.local
NEXT_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
NEXT_PUBLIC_SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DEBUG_ROUTES=true
```

Restart the API and `npm run dev` after changing env vars.

## Test event verification

### Backend — CLI message

```bash
cd backend
pip install -r requirements.txt
python scripts/sentry_test_event.py
```

Expect: `Test event sent (event_id=...)`. Confirm in Sentry → **Issues** (may appear as info).

### Backend — HTTP debug routes

With `SENTRY_DEBUG_ROUTES=true` and Sentry enabled:

```bash
curl -X POST http://127.0.0.1:8000/debug/sentry-test
curl http://127.0.0.1:8000/debug/sentry-throw
```

Second call should return 500 and create an error event.

### Frontend — debug page

With `NEXT_PUBLIC_SENTRY_DEBUG_ROUTES=true` and Sentry enabled, open:

**http://localhost:3000/sentry-test**

Use **Send test message** or **Throw client error**, then confirm events in Sentry.

### Production

Set DSNs on the host only (no `SENTRY_ENABLED` override needed). Deploy, trigger a single test via CLI or remove debug routes after verification.

## Projects

Use **separate Sentry projects** (or environments) for frontend and backend DSNs so alerts and ownership stay clear.
