"use client";

import type { TrackingSnapshot } from "@/lib/types";
import { STATUS_LABELS, type CanonicalStatus } from "@/lib/status";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLoc(
  loc: TrackingSnapshot["checkpoints"][number]["location"],
): string | null {
  if (!loc) return null;
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || null;
}

export function JourneyTimeline({
  snapshot,
}: {
  snapshot: TrackingSnapshot;
}) {
  const events = snapshot.checkpoints;

  if (events.length === 0) {
    return (
      <section className="journey">
        <h2>Journey</h2>
        <p className="journey__empty">
          No scan events yet. Waiting for the carrier webhook…
        </p>
      </section>
    );
  }

  return (
    <section className="journey">
      <h2>Journey</h2>
      <ol className="timeline">
        {events.map((ev, i) => {
          const alert =
            ev.status === "exception" ||
            ev.status === "customs_hold" ||
            ev.status === "failed_attempt" ||
            ev.status === "returned";
          return (
            <li
              key={ev.id}
              className={`timeline__item ${i === 0 ? "is-latest" : ""} ${alert ? "is-alert" : ""}`}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="timeline__rail" aria-hidden />
              <div className="timeline__body">
                <div className="timeline__top">
                  <time dateTime={ev.occurredAt}>{formatWhen(ev.occurredAt)}</time>
                  <span className="timeline__tag">
                    {STATUS_LABELS[ev.status as CanonicalStatus]}
                  </span>
                </div>
                <p className="timeline__message">{ev.message}</p>
                {formatLoc(ev.location) ? (
                  <p className="timeline__loc">{formatLoc(ev.location)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
