import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectCarrier } from "@/lib/carrier-detect";
import { createShipment, getShipmentByTracking, toSnapshot } from "@/lib/db";
import {
  getDemoJourney,
  makeDemoTrackingNumber,
  simulateJourney,
} from "@/lib/providers/demo";
import type { CarrierSlug } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  carrier: z
    .enum(["fedex", "ups", "dhl", "usps", "royal_mail", "canada_post"])
    .default("fedex"),
  trackingNumber: z.string().optional(),
  stepDelayMs: z.number().int().min(100).max(10000).optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const carrier = parsed.data.carrier as CarrierSlug;
  const trackingNumber =
    parsed.data.trackingNumber?.trim() || makeDemoTrackingNumber(carrier);
  const detected = detectCarrier(trackingNumber);
  const journey = getDemoJourney(carrier);

  let shipment = getShipmentByTracking(trackingNumber, carrier);
  if (!shipment) {
    const eddFrom = new Date(Date.now() + 2 * 86400000).toISOString();
    const eddTo = new Date(Date.now() + 3 * 86400000).toISOString();
    shipment = createShipment({
      trackingNumber,
      carrier,
      provider: "demo",
      origin: journey.origin,
      destination: journey.destination,
      estimatedDeliveryFrom: eddFrom,
      estimatedDeliveryTo: eddTo,
    });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  const baseUrl = process.env.TRACKLY_BASE_URL ?? `${proto}://${host}`;

  // Run simulation in background so we return the page URL immediately
  void simulateJourney({
    trackingNumber,
    carrier,
    baseUrl,
    stepDelayMs: parsed.data.stepDelayMs ?? 800,
  });

  return NextResponse.json({
    trackingNumber,
    carrier,
    detection: detected,
    shipment: toSnapshot(shipment),
    trackUrl: `/track/${encodeURIComponent(trackingNumber)}`,
    message: "Simulation started — open the track URL to watch live updates",
  });
}
