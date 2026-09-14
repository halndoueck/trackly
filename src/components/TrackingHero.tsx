"use client";

import type { TrackingSnapshot } from "@/lib/types";
import {
  MILESTONE_STEPS,
  STATUS_LABELS,
  milestoneIndex,
  type CanonicalStatus,
} from "@/lib/status";
import { carrierDisplayName, carrierTrackingUrl } from "@/lib/carrier-detect";

function formatEdd(snapshot: TrackingSnapshot): string {
  if (snapshot.status === "delivered" && snapshot.actualDeliveryAt) {
    return `Delivered ${new Date(snapshot.actualDeliveryAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  const from = snapshot.estimatedDelivery?.from;
  const to = snapshot.estimatedDelivery?.to;
  if (!from && !to) return "Delivery estimate pending";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  if (from && to && from !== to) return `Estimated ${fmt(from)} – ${fmt(to)}`;
  return `Estimated ${fmt(from ?? to!)}`;
}

function formatPlace(loc: TrackingSnapshot["lastLocation"]): string | null {
  if (!loc) return null;
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || null;
}

export function TrackingHero({ snapshot }: { snapshot: TrackingSnapshot }) {
  const idx = milestoneIndex(snapshot.status);
  const carrierName = carrierDisplayName(snapshot.carrier);
  const carrierUrl = carrierTrackingUrl(
    snapshot.carrier,
    snapshot.trackingNumber,
  );
  const place = formatPlace(snapshot.lastLocation ?? snapshot.destination);
  const isException =
    snapshot.status === "exception" ||
    snapshot.status === "customs_hold" ||
    snapshot.status === "failed_attempt" ||
    snapshot.status === "returned";

  return (
    <header className="hero">
      <div className="hero__brand">Trackly</div>
      <p className={`hero__status ${isException ? "hero__status--alert" : ""}`}>
        {STATUS_LABELS[snapshot.status as CanonicalStatus]}
      </p>
      <p className="hero__edd">{formatEdd(snapshot)}</p>
      {snapshot.statusDetail ? (
        <p className="hero__detail">{snapshot.statusDetail}</p>
      ) : place ? (
        <p className="hero__detail">Last seen · {place}</p>
      ) : null}

      <ol className="progress" aria-label="Shipment milestones">
        {MILESTONE_STEPS.map((step, i) => {
          const done = i <= idx && snapshot.status !== "pending";
          const current = i === idx;
          return (
            <li
              key={step}
              className={`progress__step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
            >
              <span className="progress__dot" />
              <span className="progress__label">{STATUS_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>

      <div className="hero__meta">
        <div>
          <span className="meta-label">Tracking</span>
          <code className="meta-value">{snapshot.trackingNumber}</code>
        </div>
        <div>
          <span className="meta-label">Carrier</span>
          <span className="meta-value">{carrierName}</span>
        </div>
        {carrierUrl ? (
          <a
            className="btn-ghost"
            href={carrierUrl}
            target="_blank"
            rel="noreferrer"
          >
            Carrier site
          </a>
        ) : null}
      </div>
    </header>
  );
}
