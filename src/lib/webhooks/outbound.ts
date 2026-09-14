import { nanoid } from "nanoid";
import { recordOutboundDelivery } from "../db";
import type { CanonicalStatus } from "../status";
import type { CarrierSlug } from "../types";
import { signOutbound } from "./verify";

export interface OutboundTrackingEvent {
  event_id: string;
  type: "tracking.updated";
  tracking_number: string;
  carrier: CarrierSlug;
  status: CanonicalStatus;
  substatus: string | null;
  occurred_at: string;
  message: string;
  is_milestone: boolean;
  shipment_id: string;
}

const MILESTONES = new Set<CanonicalStatus>([
  "label_created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "returned",
  "exception",
]);

export function buildOutboundEvent(input: {
  trackingNumber: string;
  carrier: CarrierSlug;
  status: CanonicalStatus;
  substatus: string | null;
  occurredAt: string;
  message: string;
  shipmentId: string;
}): OutboundTrackingEvent {
  return {
    event_id: nanoid(),
    type: "tracking.updated",
    tracking_number: input.trackingNumber,
    carrier: input.carrier,
    status: input.status,
    substatus: input.substatus,
    occurred_at: input.occurredAt,
    message: input.message,
    is_milestone: MILESTONES.has(input.status),
    shipment_id: input.shipmentId,
  };
}

export async function deliverOutboundWebhook(
  event: OutboundTrackingEvent,
  url: string,
  secret: string,
): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signOutbound(body, timestamp, secret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trackly-Signature": signature,
        "X-Trackly-Timestamp": timestamp,
        "Idempotency-Key": event.event_id,
      },
      body,
    });
    recordOutboundDelivery({
      eventId: event.event_id,
      url,
      statusCode: res.status,
      attempts: 1,
      delivered: res.ok,
      lastError: res.ok ? null : `HTTP ${res.status}`,
    });
    return { ok: res.ok, statusCode: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "delivery failed";
    recordOutboundDelivery({
      eventId: event.event_id,
      url,
      statusCode: null,
      attempts: 1,
      delivered: false,
      lastError: message,
    });
    return { ok: false, statusCode: null, error: message };
  }
}
