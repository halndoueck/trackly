# Verification results

Agentic loop outcomes for Trackly (run locally against `next start` on :3000).

## Unit (`npm run test:unit`) — PASS

- Status machine monotonic + terminal lock
- Carrier auto-detect (UPS / FedEx / DHL prefixes)
- AfterShip / EasyPost / demo HMAC verification
- Provider payload normalization
- SQLite ingest, webhook idempotency, delivered lock

## E2E (`npm run test:e2e`) — PASS

- `GET /api/carriers`
- Demo webhook rejects bad HMAC (401)
- Full FedEx simulated journey → `delivered` with ≥5 checkpoints via signed webhooks
- AfterShip-shaped webhook + idempotent replay
- EasyPost-shaped webhook (DHL carrier mapping)
- Manual signed demo webhook → delivered

## Build / lint — PASS

- `next build` succeeds
- `eslint` clean

## Manual UI

Exercised via computer-use agent against the live server (home → DHL demo → live journey page).
