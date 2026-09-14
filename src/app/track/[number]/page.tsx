import Link from "next/link";
import { notFound } from "next/navigation";
import { getShipmentByTracking, toSnapshot } from "@/lib/db";
import { LiveTrackingView } from "@/components/LiveTrackingView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const trackingNumber = decodeURIComponent(number).trim();
  const shipment = getShipmentByTracking(trackingNumber);
  if (!shipment) notFound();

  return (
    <main>
      <div className="shell">
        <Link href="/" className="back-link">
          ← Track another package
        </Link>
      </div>
      <LiveTrackingView initial={toSnapshot(shipment)} />
    </main>
  );
}
