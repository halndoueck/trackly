"use client";

import { useEffect, useState } from "react";
import type { TrackingSnapshot } from "@/lib/types";
import { isTerminal, type CanonicalStatus } from "@/lib/status";
import { TrackingHero } from "./TrackingHero";
import { JourneyTimeline } from "./JourneyTimeline";

export function LiveTrackingView({
  initial,
}: {
  initial: TrackingSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setSnapshot(initial);
  }, [initial]);

  useEffect(() => {
    if (isTerminal(snapshot.status as CanonicalStatus)) return;

    const url = `/api/track/${encodeURIComponent(snapshot.trackingNumber)}/stream`;
    const es = new EventSource(url);
    setLive(true);

    es.addEventListener("snapshot", (e) => {
      setSnapshot(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("shipment.updated", (e) => {
      setSnapshot(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("complete", () => {
      es.close();
      setLive(false);
    });
    es.onerror = () => {
      // Fall back to light polling
      es.close();
      setLive(false);
    };

    return () => {
      es.close();
    };
  }, [snapshot.trackingNumber, snapshot.status]);

  // Polling fallback when SSE drops and shipment is still active
  useEffect(() => {
    if (live || isTerminal(snapshot.status as CanonicalStatus)) return;
    const id = setInterval(async () => {
      const res = await fetch(
        `/api/track/${encodeURIComponent(snapshot.trackingNumber)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setSnapshot(data.shipment);
    }, 2000);
    return () => clearInterval(id);
  }, [live, snapshot.trackingNumber, snapshot.status]);

  return (
    <div className="track-page">
      <TrackingHero snapshot={snapshot} />
      <div className="live-pill" data-live={live ? "on" : "off"}>
        {isTerminal(snapshot.status as CanonicalStatus)
          ? "Journey complete"
          : live
            ? "Live updates"
            : "Refreshing…"}
      </div>
      <JourneyTimeline snapshot={snapshot} />
    </div>
  );
}
