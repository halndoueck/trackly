"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TrackForm() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tn = trackingNumber.trim();
    if (tn.length < 4) {
      setError("Enter a valid tracking number.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: tn,
          carrier: carrier || undefined,
          simulate: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start tracking");
        return;
      }
      router.push(`/track/${encodeURIComponent(data.shipment.trackingNumber)}`);
    });
  }

  return (
    <form className="track-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Tracking number</span>
        <input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="1Z… / FedEx / DHL / FDX…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>Carrier (optional)</span>
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          <option value="">Auto-detect</option>
          <option value="fedex">FedEx</option>
          <option value="ups">UPS</option>
          <option value="dhl">DHL</option>
          <option value="usps">USPS</option>
          <option value="royal_mail">Royal Mail</option>
          <option value="canada_post">Canada Post</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Looking up…" : "Track package"}
      </button>
    </form>
  );
}
