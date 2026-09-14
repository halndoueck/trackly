import type { CanonicalStatus } from "./status";

export type CarrierSlug =
  | "fedex"
  | "ups"
  | "dhl"
  | "usps"
  | "royal_mail"
  | "canada_post"
  | "unknown";

export interface Location {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postal?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface TrackingEventInput {
  eventId?: string;
  occurredAt: string;
  status: CanonicalStatus;
  substatus?: string | null;
  message: string;
  location?: Location | null;
  rawCode?: string | null;
  rawDescription?: string | null;
  source: string;
  rawPayload?: unknown;
}

export interface ShipmentRow {
  id: string;
  tracking_number: string;
  carrier: CarrierSlug;
  status: CanonicalStatus;
  substatus: string | null;
  status_detail: string | null;
  origin_json: string | null;
  destination_json: string | null;
  last_location_json: string | null;
  estimated_delivery_from: string | null;
  estimated_delivery_to: string | null;
  actual_delivery_at: string | null;
  provider: string;
  provider_tracker_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckpointRow {
  id: string;
  shipment_id: string;
  event_id: string;
  occurred_at: string;
  received_at: string;
  status: CanonicalStatus;
  substatus: string | null;
  message: string;
  location_json: string | null;
  raw_code: string | null;
  raw_description: string | null;
  source: string;
  raw_payload_json: string | null;
}

export interface TrackingSnapshot {
  id: string;
  trackingNumber: string;
  carrier: CarrierSlug;
  status: CanonicalStatus;
  substatus: string | null;
  statusDetail: string | null;
  origin: Location | null;
  destination: Location | null;
  lastLocation: Location | null;
  estimatedDelivery: { from: string | null; to: string | null } | null;
  actualDeliveryAt: string | null;
  provider: string;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  checkpoints: Array<{
    id: string;
    eventId: string;
    occurredAt: string;
    status: CanonicalStatus;
    substatus: string | null;
    message: string;
    location: Location | null;
    rawCode: string | null;
    source: string;
  }>;
}
