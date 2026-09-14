import {
  appendTrackingEvent,
  claimWebhookEvent,
  createShipment,
  getShipmentByTracking,
  toSnapshot,
  updateShipmentEstimates,
} from "../db";
import type { NormalizedWebhook } from "./parse";
import type { TrackingSnapshot } from "../types";
import { buildOutboundEvent, deliverOutboundWebhook } from "../webhooks/outbound";
import { publishShipmentUpdate } from "../sse";

export async function ingestNormalizedWebhook(
  provider: string,
  normalized: NormalizedWebhook,
): Promise<{ accepted: boolean; duplicate: boolean; snapshot: TrackingSnapshot | null }> {
  if (!normalized.trackingNumber) {
    return { accepted: false, duplicate: false, snapshot: null };
  }

  const claimed = claimWebhookEvent(normalized.eventId, provider, normalized);
  if (!claimed) {
    const existing = getShipmentByTracking(
      normalized.trackingNumber,
      normalized.carrier === "unknown" ? undefined : normalized.carrier,
    );
    return {
      accepted: true,
      duplicate: true,
      snapshot: existing ? toSnapshot(existing) : null,
    };
  }

  let shipment = getShipmentByTracking(
    normalized.trackingNumber,
    normalized.carrier === "unknown" ? undefined : normalized.carrier,
  );
  if (!shipment) {
    shipment = createShipment({
      trackingNumber: normalized.trackingNumber,
      carrier: normalized.carrier,
      provider,
    });
  }

  // Apply oldest-first so mergeStatus advances correctly
  const sorted = [...normalized.events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  let latestMessage = "";
  for (const event of sorted) {
    const result = appendTrackingEvent(shipment.id, event);
    shipment = result.shipment;
    latestMessage = event.message;
    if (result.inserted) {
      publishShipmentUpdate(shipment.id);
      const outboundUrl = process.env.TRACKLY_OUTBOUND_WEBHOOK_URL;
      const outboundSecret =
        process.env.TRACKLY_OUTBOUND_WEBHOOK_SECRET ?? "trackly-dev-secret";
      if (outboundUrl) {
        const evt = buildOutboundEvent({
          trackingNumber: shipment.tracking_number,
          carrier: shipment.carrier as TrackingSnapshot["carrier"],
          status: shipment.status as TrackingSnapshot["status"],
          substatus: shipment.substatus,
          occurredAt: event.occurredAt,
          message: event.message,
          shipmentId: shipment.id,
        });
        // fire-and-forget; failures are recorded
        void deliverOutboundWebhook(evt, outboundUrl, outboundSecret);
      }
    }
  }

  if (normalized.estimatedDeliveryFrom || normalized.estimatedDeliveryTo) {
    updateShipmentEstimates(
      shipment.id,
      normalized.estimatedDeliveryFrom ?? null,
      normalized.estimatedDeliveryTo ?? null,
    );
    shipment = getShipmentByTracking(normalized.trackingNumber, shipment.carrier as TrackingSnapshot["carrier"])!;
  }

  void latestMessage;
  return {
    accepted: true,
    duplicate: false,
    snapshot: toSnapshot(shipment),
  };
}
