import type { TrackingEventInput } from "../types";
import type { CanonicalStatus } from "../status";
import { mapAfterShipTag, mapEasyPostStatus, inferSubstatus } from "../normalize";
import type { CarrierSlug } from "../types";
import { detectCarrier } from "../carrier-detect";

export interface NormalizedWebhook {
  eventId: string;
  trackingNumber: string;
  carrier: CarrierSlug;
  events: TrackingEventInput[];
  estimatedDeliveryFrom?: string | null;
  estimatedDeliveryTo?: string | null;
}

export function parseAfterShipWebhook(payload: unknown): NormalizedWebhook {
  const body = payload as {
    event_id?: string;
    msg?: {
      id?: string;
      tracking_number?: string;
      slug?: string;
      tag?: string;
      subtag?: string;
      subtag_message?: string;
      checkpoints?: Array<{
        checkpoint_time?: string;
        message?: string;
        tag?: string;
        subtag?: string;
        city?: string;
        state?: string;
        country_iso3?: string;
        zip?: string;
        location?: string;
      }>;
      expected_delivery?: string;
    };
  };

  const msg = body.msg ?? {};
  const trackingNumber = msg.tracking_number ?? "";
  const slug = (msg.slug ?? "unknown").toLowerCase().replace(/-/g, "_");
  const carrier = (
    ["fedex", "ups", "dhl", "usps"].includes(slug)
      ? slug
      : detectCarrier(trackingNumber).carrier
  ) as CarrierSlug;

  const checkpoints = msg.checkpoints ?? [];
  const events: TrackingEventInput[] =
    checkpoints.length > 0
      ? checkpoints.map((cp, i) => {
          const status = mapAfterShipTag(cp.tag ?? msg.tag ?? "InTransit");
          const message = cp.message ?? cp.subtag ?? status;
          return {
            eventId: `${body.event_id ?? msg.id ?? "as"}:${i}:${cp.checkpoint_time}:${cp.tag}`,
            occurredAt: cp.checkpoint_time
              ? new Date(cp.checkpoint_time).toISOString()
              : new Date().toISOString(),
            status,
            substatus: cp.subtag ?? inferSubstatus(message, status),
            message,
            location: {
              city: cp.city,
              region: cp.state,
              country: cp.country_iso3,
              postal: cp.zip,
            },
            rawCode: cp.tag ?? null,
            rawDescription: cp.message ?? null,
            source: "aftership",
            rawPayload: cp,
          };
        })
      : [
          {
            eventId: body.event_id ?? msg.id ?? `as:${trackingNumber}:${msg.tag}`,
            occurredAt: new Date().toISOString(),
            status: mapAfterShipTag(msg.tag ?? "Pending"),
            substatus: msg.subtag ?? null,
            message: msg.subtag_message ?? msg.tag ?? "Update",
            source: "aftership",
            rawPayload: msg,
          },
        ];

  return {
    eventId: body.event_id ?? msg.id ?? `as:${trackingNumber}:${Date.now()}`,
    trackingNumber,
    carrier,
    events,
    estimatedDeliveryFrom: msg.expected_delivery ?? null,
    estimatedDeliveryTo: msg.expected_delivery ?? null,
  };
}

export function parseEasyPostWebhook(payload: unknown): NormalizedWebhook {
  const body = payload as {
    id?: string;
    description?: string;
    result?: {
      id?: string;
      tracking_code?: string;
      status?: string;
      carrier?: string;
      est_delivery_date?: string;
      tracking_details?: Array<{
        message?: string;
        status?: string;
        datetime?: string;
        tracking_location?: {
          city?: string;
          state?: string;
          country?: string;
          zip?: string;
        };
      }>;
    };
  };

  const result = body.result ?? {};
  const trackingNumber = result.tracking_code ?? "";
  const carrierName = (result.carrier ?? "").toLowerCase();
  let carrier: CarrierSlug = "unknown";
  if (carrierName.includes("fedex")) carrier = "fedex";
  else if (carrierName.includes("ups")) carrier = "ups";
  else if (carrierName.includes("dhl")) carrier = "dhl";
  else if (carrierName.includes("usps")) carrier = "usps";
  else carrier = detectCarrier(trackingNumber).carrier;

  const details = result.tracking_details ?? [];
  const events: TrackingEventInput[] =
    details.length > 0
      ? details.map((d, i) => {
          const status = mapEasyPostStatus(d.status ?? result.status ?? "unknown");
          const message = d.message ?? status;
          return {
            eventId: `${body.id ?? result.id}:${i}:${d.datetime}:${d.status}`,
            occurredAt: d.datetime
              ? new Date(d.datetime).toISOString()
              : new Date().toISOString(),
            status,
            substatus: inferSubstatus(message, status),
            message,
            location: d.tracking_location
              ? {
                  city: d.tracking_location.city,
                  region: d.tracking_location.state,
                  country: d.tracking_location.country,
                  postal: d.tracking_location.zip,
                }
              : null,
            rawCode: d.status ?? null,
            rawDescription: d.message ?? null,
            source: "easypost",
            rawPayload: d,
          };
        })
      : [
          {
            eventId: body.id ?? result.id ?? `ep:${trackingNumber}`,
            occurredAt: new Date().toISOString(),
            status: mapEasyPostStatus(result.status ?? "unknown"),
            message: result.status ?? "Update",
            source: "easypost",
            rawPayload: result,
          },
        ];

  return {
    eventId: body.id ?? result.id ?? `ep:${trackingNumber}:${Date.now()}`,
    trackingNumber,
    carrier,
    events,
    estimatedDeliveryFrom: result.est_delivery_date ?? null,
    estimatedDeliveryTo: result.est_delivery_date ?? null,
  };
}

export function parseDemoWebhook(payload: unknown): NormalizedWebhook {
  const body = payload as {
    event_id: string;
    tracking_number: string;
    carrier: CarrierSlug;
    status: CanonicalStatus;
    message: string;
    occurred_at: string;
    substatus?: string | null;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      postal?: string;
    } | null;
    estimated_delivery_from?: string | null;
    estimated_delivery_to?: string | null;
  };

  return {
    eventId: body.event_id,
    trackingNumber: body.tracking_number,
    carrier: body.carrier,
    estimatedDeliveryFrom: body.estimated_delivery_from,
    estimatedDeliveryTo: body.estimated_delivery_to,
    events: [
      {
        eventId: body.event_id,
        occurredAt: body.occurred_at,
        status: body.status,
        substatus: body.substatus ?? null,
        message: body.message,
        location: body.location ?? null,
        source: "demo",
        rawPayload: body,
      },
    ],
  };
}
