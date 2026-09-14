import { NextRequest } from "next/server";
import { getShipmentById, getShipmentByTracking, toSnapshot } from "@/lib/db";
import { isTerminal } from "@/lib/status";
import type { CanonicalStatus } from "@/lib/status";
import { subscribeShipmentUpdates } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ number: string }> },
) {
  const { number } = await ctx.params;
  const trackingNumber = decodeURIComponent(number).trim();
  const shipment = getShipmentByTracking(trackingNumber);
  if (!shipment) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("snapshot", toSnapshot(shipment));

      unsubscribe = subscribeShipmentUpdates((shipmentId) => {
        if (shipmentId !== shipment.id) return;
        const fresh = getShipmentById(shipment.id);
        if (!fresh) return;
        send("shipment.updated", toSnapshot(fresh));
        if (isTerminal(fresh.status as CanonicalStatus)) {
          send("complete", { status: fresh.status });
        }
      });

      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
