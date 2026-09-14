import { nanoid } from "nanoid";
import type { CanonicalStatus } from "../status";
import type { CarrierSlug, Location } from "../types";
import { signOutbound } from "../webhooks/verify";

export interface JourneyStep {
  status: CanonicalStatus;
  message: string;
  location: Location;
  delayMs: number;
  substatus?: string | null;
}

const JOURNEYS: Record<
  CarrierSlug,
  { origin: Location; destination: Location; steps: Omit<JourneyStep, "delayMs">[] }
> = {
  fedex: {
    origin: { city: "Memphis", region: "TN", country: "US", postal: "38118" },
    destination: { city: "Austin", region: "TX", country: "US", postal: "78701" },
    steps: [
      {
        status: "label_created",
        message: "Shipment information sent to FedEx",
        location: { city: "Memphis", region: "TN", country: "US" },
      },
      {
        status: "picked_up",
        message: "Picked up",
        location: { city: "Memphis", region: "TN", country: "US" },
      },
      {
        status: "in_transit",
        message: "Arrived at FedEx hub",
        location: { city: "Memphis", region: "TN", country: "US" },
      },
      {
        status: "in_transit",
        message: "Departed FedEx location",
        location: { city: "Dallas", region: "TX", country: "US" },
      },
      {
        status: "out_for_delivery",
        message: "On FedEx vehicle for delivery",
        location: { city: "Austin", region: "TX", country: "US" },
      },
      {
        status: "delivered",
        message: "Delivered — Left at front door. Signed for by A. RIVERA",
        location: { city: "Austin", region: "TX", country: "US", postal: "78701" },
      },
    ],
  },
  ups: {
    origin: { city: "Louisville", region: "KY", country: "US" },
    destination: { city: "Seattle", region: "WA", country: "US", postal: "98101" },
    steps: [
      {
        status: "label_created",
        message: "Shipper created a label, UPS has not received the package yet",
        location: { city: "Louisville", region: "KY", country: "US" },
      },
      {
        status: "picked_up",
        message: "Origin Scan",
        location: { city: "Louisville", region: "KY", country: "US" },
      },
      {
        status: "in_transit",
        message: "Departed from Facility",
        location: { city: "Denver", region: "CO", country: "US" },
      },
      {
        status: "in_transit",
        message: "Arrived at Facility",
        location: { city: "Seattle", region: "WA", country: "US" },
      },
      {
        status: "out_for_delivery",
        message: "Out For Delivery Today",
        location: { city: "Seattle", region: "WA", country: "US" },
      },
      {
        status: "delivered",
        message: "Delivered",
        location: { city: "Seattle", region: "WA", country: "US", postal: "98101" },
      },
    ],
  },
  dhl: {
    origin: { city: "Leipzig", region: "SN", country: "DE" },
    destination: { city: "New York", region: "NY", country: "US", postal: "10001" },
    steps: [
      {
        status: "label_created",
        message: "Shipment data received",
        location: { city: "Leipzig", region: "SN", country: "DE" },
      },
      {
        status: "picked_up",
        message: "Shipment picked up",
        location: { city: "Leipzig", region: "SN", country: "DE" },
      },
      {
        status: "in_transit",
        message: "Processed at DHL facility",
        location: { city: "Leipzig", region: "SN", country: "DE" },
      },
      {
        status: "customs_hold",
        message: "Clearance event — Held for customs review",
        location: { city: "New York", region: "NY", country: "US" },
        substatus: "customs_hold",
      },
      {
        status: "in_transit",
        message: "Customs clearance complete — Arrived at delivery facility",
        location: { city: "New York", region: "NY", country: "US" },
      },
      {
        status: "out_for_delivery",
        message: "With delivery courier",
        location: { city: "New York", region: "NY", country: "US" },
      },
      {
        status: "delivered",
        message: "Delivered",
        location: { city: "New York", region: "NY", country: "US", postal: "10001" },
      },
    ],
  },
  usps: {
    origin: { city: "Los Angeles", region: "CA", country: "US" },
    destination: { city: "Chicago", region: "IL", country: "US" },
    steps: [
      {
        status: "label_created",
        message: "USPS Awaiting Item",
        location: { city: "Los Angeles", region: "CA", country: "US" },
      },
      {
        status: "picked_up",
        message: "Accepted at USPS Origin Facility",
        location: { city: "Los Angeles", region: "CA", country: "US" },
      },
      {
        status: "in_transit",
        message: "In Transit to Next Facility",
        location: { city: "Phoenix", region: "AZ", country: "US" },
      },
      {
        status: "out_for_delivery",
        message: "Out for Delivery",
        location: { city: "Chicago", region: "IL", country: "US" },
      },
      {
        status: "delivered",
        message: "Delivered, In/At Mailbox",
        location: { city: "Chicago", region: "IL", country: "US" },
      },
    ],
  },
  royal_mail: {
    origin: { city: "London", region: "ENG", country: "GB" },
    destination: { city: "Manchester", region: "ENG", country: "GB" },
    steps: [
      {
        status: "label_created",
        message: "Item accepted at ParcelShop",
        location: { city: "London", region: "ENG", country: "GB" },
      },
      {
        status: "in_transit",
        message: "Item received at Royal Mail depot",
        location: { city: "London", region: "ENG", country: "GB" },
      },
      {
        status: "out_for_delivery",
        message: "Out for delivery",
        location: { city: "Manchester", region: "ENG", country: "GB" },
      },
      {
        status: "delivered",
        message: "Delivered",
        location: { city: "Manchester", region: "ENG", country: "GB" },
      },
    ],
  },
  canada_post: {
    origin: { city: "Toronto", region: "ON", country: "CA" },
    destination: { city: "Vancouver", region: "BC", country: "CA" },
    steps: [
      {
        status: "label_created",
        message: "Electronic information submitted by shipper",
        location: { city: "Toronto", region: "ON", country: "CA" },
      },
      {
        status: "in_transit",
        message: "Item processed",
        location: { city: "Winnipeg", region: "MB", country: "CA" },
      },
      {
        status: "out_for_delivery",
        message: "Out for delivery",
        location: { city: "Vancouver", region: "BC", country: "CA" },
      },
      {
        status: "delivered",
        message: "Delivered",
        location: { city: "Vancouver", region: "BC", country: "CA" },
      },
    ],
  },
  unknown: {
    origin: { city: "Origin", country: "XX" },
    destination: { city: "Destination", country: "XX" },
    steps: [
      {
        status: "label_created",
        message: "Label created",
        location: { city: "Origin", country: "XX" },
      },
      {
        status: "in_transit",
        message: "In transit",
        location: { city: "Hub", country: "XX" },
      },
      {
        status: "delivered",
        message: "Delivered",
        location: { city: "Destination", country: "XX" },
      },
    ],
  },
};

export function getDemoJourney(carrier: CarrierSlug) {
  return JOURNEYS[carrier] ?? JOURNEYS.unknown;
}

export function makeDemoTrackingNumber(carrier: CarrierSlug): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  switch (carrier) {
    case "fedex":
      return `FDX${Date.now().toString().slice(-8)}${rand.slice(0, 4)}`;
    case "ups":
      return `1Z999AA1${rand.slice(0, 8).padEnd(8, "0")}`.slice(0, 18);
    case "dhl":
      return `DHL${Date.now().toString().slice(-7)}`;
    case "usps":
      return `9400${Date.now().toString().slice(-16)}`;
    default:
      return `TRK${rand}${Date.now().toString().slice(-6)}`;
  }
}

/** Fire journey steps as signed demo webhooks against the local ingest endpoint. */
export async function simulateJourney(opts: {
  trackingNumber: string;
  carrier: CarrierSlug;
  baseUrl: string;
  stepDelayMs?: number;
  secret?: string;
}): Promise<{ steps: number }> {
  const journey = getDemoJourney(opts.carrier);
  const secret = opts.secret ?? process.env.TRACKLY_DEMO_WEBHOOK_SECRET ?? "demo-webhook-secret";
  const delay = opts.stepDelayMs ?? 1200;
  const eddFrom = new Date(Date.now() + 2 * 86400000).toISOString();
  const eddTo = new Date(Date.now() + 3 * 86400000).toISOString();

  let i = 0;
  for (const step of journey.steps) {
    const occurred = new Date(Date.now() - (journey.steps.length - i) * 3600000 + i * 1000);
    const payload = {
      event_id: `demo_${nanoid()}`,
      tracking_number: opts.trackingNumber,
      carrier: opts.carrier,
      status: step.status,
      message: step.message,
      occurred_at: occurred.toISOString(),
      substatus: step.substatus ?? null,
      location: step.location,
      estimated_delivery_from: eddFrom,
      estimated_delivery_to: eddTo,
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signOutbound(body, timestamp, secret);

    await fetch(`${opts.baseUrl}/api/webhooks/demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trackly-Signature": signature,
        "X-Trackly-Timestamp": timestamp,
      },
      body,
    });

    i += 1;
    if (i < journey.steps.length) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { steps: journey.steps.length };
}
