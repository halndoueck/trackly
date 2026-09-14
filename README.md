# Trackly

Multi-carrier order tracking with a unified journey model, signed webhook ingest (AfterShip / EasyPost / demo), live SSE updates, and a clear status-hero + timeline UI.

## Why this shape

Research consensus for a production-quality MVP:

1. **Buy normalization, own the experience** — AfterShip or EasyPost for carrier coverage; your DB for canonical status, branded tracking, and customer webhooks.
2. **Webhooks first, poll for reconciliation** — never poll carriers from the browser.
3. **Append-only checkpoints + monotonic status** — never let `in_transit` overwrite `delivered`.
4. **First viewport answers two questions** — where is it, when will it arrive.

Trackly implements that architecture with a working **demo simulator** so you can verify the full loop without vendor API keys.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click a carrier under **Watch a live journey** — the page streams scan events as signed webhooks arrive.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/trackers` | Register a tracking number (`{ trackingNumber, carrier?, simulate? }`) |
| `GET` | `/api/track/:number` | Full shipment snapshot + checkpoints |
| `GET` | `/api/track/:number/stream` | SSE live updates |
| `POST` | `/api/demo/simulate` | Start a FedEx/UPS/DHL/USPS journey simulation |
| `POST` | `/api/webhooks/demo` | Signed demo ingest (`X-Trackly-Signature`, `X-Trackly-Timestamp`) |
| `POST` | `/api/webhooks/aftership` | AfterShip-compatible ingest |
| `POST` | `/api/webhooks/easypost` | EasyPost-compatible ingest |
| `GET` | `/api/carriers` | Carrier + provider catalog |

## Canonical statuses

`pending` → `label_created` → `picked_up` → `in_transit` → `out_for_delivery` → `delivered`

Branches: `failed_attempt`, `customs_hold`, `exception`, `returned`, `available_for_pickup`, `expired`, `cancelled`

## Production wiring

1. Set `AFTERSHIP_WEBHOOK_SECRET` (or EasyPost equivalent) and point the provider webhook at your public URL.
2. Optionally set `TRACKLY_OUTBOUND_WEBHOOK_URL` + `TRACKLY_OUTBOUND_WEBHOOK_SECRET` to push signed `tracking.updated` events to your order system.
3. Swap `TRACKLY_PROVIDER=demo` for a real provider adapter when you have API keys (register trackers with AfterShip/EasyPost on `POST /api/trackers`).

## Verify

```bash
npm run test:unit
npm run dev   # separate terminal
npm run test:e2e
```

## Stack

Next.js 15 · SQLite (better-sqlite3) · Zod · SSE · Syne / DM Sans
