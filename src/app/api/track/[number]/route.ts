import { NextRequest, NextResponse } from "next/server";
import { getShipmentByTracking, toSnapshot } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ number: string }> },
) {
  const { number } = await ctx.params;
  const trackingNumber = decodeURIComponent(number).trim();
  const shipment = getShipmentByTracking(trackingNumber);
  if (!shipment) {
    return NextResponse.json(
      { error: "Tracking number not found", trackingNumber },
      { status: 404 },
    );
  }
  return NextResponse.json({ shipment: toSnapshot(shipment) });
}
