"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CARRIERS = [
  { slug: "fedex", label: "FedEx (domestic)" },
  { slug: "ups", label: "UPS (domestic)" },
  { slug: "dhl", label: "DHL (intl + customs)" },
  { slug: "usps", label: "USPS" },
] as const;

export function DemoLauncher() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);

  function launch(carrier: string) {
    setActive(carrier);
    startTransition(async () => {
      const res = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, stepDelayMs: 900 }),
      });
      const data = await res.json();
      if (res.ok && data.trackingNumber) {
        router.push(`/track/${encodeURIComponent(data.trackingNumber)}`);
      }
      setActive(null);
    });
  }

  return (
    <div className="demo-launcher">
      <p className="demo-launcher__label">Watch a live journey</p>
      <div className="demo-launcher__row">
        {CARRIERS.map((c) => (
          <button
            key={c.slug}
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={() => launch(c.slug)}
          >
            {active === c.slug ? "Starting…" : c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
