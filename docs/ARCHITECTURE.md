# Trackly architecture

## Research verdict (what we built on)

| Concern | Decision |
|--------|----------|
| Carrier coverage | Aggregator pattern (AfterShip / EasyPost adapters) + demo simulator |
| Primary update path | Signed webhooks → normalize → SQLite → SSE |
| Display | Status hero + EDD first; vertical journey timeline below |
| Status model | Canonical enum with monotonic merge; append-only checkpoints |
| Outbound | Optional signed `tracking.updated` webhooks to your order system |

Direct FedEx/UPS/DHL APIs are deferred: high onboarding cost for MVP, weak long-tail international coverage. Add account-native push (FedEx AIV, UPS Track Alert, DHL Unified Push) later when volume justifies it.

## Data flow

```
Carrier / Aggregator / Demo simulator
        │  HMAC-signed webhook
        ▼
 /api/webhooks/{aftership|easypost|demo}
        │  verify → idempotent claim(event_id)
        ▼
 normalize → map to CanonicalStatus
        │
        ▼
 shipments + checkpoints (SQLite)
        │
        ├─► SSE /api/track/:tn/stream  →  branded track page
        └─► outbound webhook (optional) →  your OMS / notifications
```

## Canonical status machine

Forward-only ranks. `delivered` / `returned` / `expired` / `cancelled` are terminal.
Side branches (`customs_hold`, `failed_attempt`, `exception`) can surface without blocking history.

## Idempotency

1. `webhook_events.event_id` UNIQUE — duplicate provider deliveries are no-ops.
2. `checkpoints.event_id` UNIQUE — duplicate scan events are no-ops.
3. Outbound deliveries keyed by `event_id` for replay-safe customer webhooks.

## Production notes

- Single-node SSE bus is in-memory (fine for `next start` / one instance). Use Redis pub/sub for multi-instance.
- Set `AFTERSHIP_WEBHOOK_SECRET` / `EASYPOST_WEBHOOK_SECRET` in production (unsigned accepted only when secret unset, for local demos).
- Never poll carriers from the browser; use webhooks + occasional provider reconciliation jobs.
