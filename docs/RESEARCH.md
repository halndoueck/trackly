# Research brief — multi-carrier tracking

Synthesized from parallel research agents + public API comparisons (AfterShip, EasyPost, Ship24, TrackingMore, direct carrier APIs).

## Build vs buy

**Buy ingest + normalization. Own registry, status store, webhooks-out, and UX.**

- **AfterShip**: best default for tracking-only + CX; mature HMAC webhooks; 1000+ carriers; API often on higher tiers.
- **EasyPost**: best if you also buy labels/rates; solid Tracker API + webhooks; thinner long-tail intl.
- **Ship24 / TrackingMore**: strong cost / intl alternatives.
- **Direct FedEx / UPS / DHL**: highest fidelity (POD, account push) but N integrations, sandboxes quirky, no long-tail postal.

## Journey UX that works

Industry pattern (Amazon / Shopify / AfterShip track pages):

1. First viewport: brand + **current status** + **EDD/delivered date** + tracking # + carrier.
2. Below: vertical checkpoint timeline (time · location · message).
3. Map optional and secondary.
4. Live updates via SSE (or 15–30s poll fallback).

## Webhook hard requirements

- Verify signature on raw body (constant-time).
- Return 2xx fast; process async when needed.
- Idempotency key = provider event id.
- Store raw payload forever; map forward only.
- Outbound: `Idempotency-Key`, timestamped HMAC, exponential retry + dead-letter.

## What we verified in this repo

Unit + e2e scripts prove: status machine, HMAC verify, AfterShip/EasyPost/demo parsers, idempotent ingest, full FedEx simulated journey to `delivered` over live HTTP webhooks.
