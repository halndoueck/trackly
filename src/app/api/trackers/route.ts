import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectCarrier } from "@/lib/carrier-detect";
import {
  createShipment,
  getShipmentByTracking,
  toSnapshot,
  updateShipmentEstimates,
} from "@/lib/db";
import { getDemoJourney } from "@/lib/providers/demo";
import type { CarrierSlug } from "@/lib/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  trackingNumber: z.string().min(4).max(64),
  carrier: z
    .enum([
      "fedex",
      "ups",
      "dhl",
      "usps",
      "royal_mail",
      "canada_post",
      "unknown",
    ])
    .optional(),
  orderId: z.string().optional(),
  simulate: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const trackingNumber = parsed.data.trackingNumber.trim().replace(/\s+/g, "");
  const detected = detectCarrier(trackingNumber);
  const carrier = (parsed.data.carrier ?? detected.carrier) as CarrierSlug;

  let shipment = getShipmentByTracking(trackingNumber, carrier === "unknown" ? undefined : carrier);
  if (!shipment) {
    const journey = getDemoJourney(carrier);
    const eddFrom = new Date(Date.now() + 2 * 86400000).toISOString();
    const eddTo = new Date(Date.now() + 3 * 86400000).toISOString();

    let provider = process.env.TRACKLY_PROVIDER ?? "demo";
    let providerTrackerId: string | null = null;

    if (process.env.AFTERSHIP_API_KEY) {
      const { registerAfterShipTracker } = await import(
        "@/lib/providers/aftership"
      );
      const registered = await registerAfterShipTracker({
        trackingNumber,
        carrierSlug: carrier,
      });
      if (registered.ok) {
        provider = "aftership";
        providerTrackerId = registered.id;
      }
    }

    shipment = createShipment({
      trackingNumber,
      carrier,
      provider,
      providerTrackerId,
      orderId: parsed.data.orderId ?? null,
      origin: journey.origin,
      destination: journey.destination,
      estimatedDeliveryFrom: eddFrom,
      estimatedDeliveryTo: eddTo,
    });
    updateShipmentEstimates(shipment.id, eddFrom, eddTo);
    shipment = getShipmentByTracking(trackingNumber, carrier)!;
  }

  const snapshot = toSnapshot(shipment);

  // Kick off simulation asynchronously when requested (demo mode)
  if (parsed.data.simulate) {
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl = process.env.TRACKLY_BASE_URL ?? `${proto}://${host}`;
    const { simulateJourney } = await import("@/lib/providers/demo");
    void simulateJourney({
      trackingNumber,
      carrier: snapshot.carrier,
      baseUrl,
      stepDelayMs: Number(process.env.TRACKLY_SIM_DELAY_MS ?? 900),
    });
  }

  return NextResponse.json({
    shipment: snapshot,
    detection: detected,
  });
}
