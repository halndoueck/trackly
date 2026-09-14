import type { CarrierSlug } from "./types";

interface CarrierPattern {
  slug: CarrierSlug;
  name: string;
  patterns: RegExp[];
  trackingUrl: (tn: string) => string;
}

export const CARRIERS: CarrierPattern[] = [
  {
    slug: "ups",
    name: "UPS",
    patterns: [/^1Z[A-Z0-9]{16}$/i, /^T\d{10}$/i],
    trackingUrl: (tn) =>
      `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`,
  },
  {
    slug: "fedex",
    name: "FedEx",
    patterns: [/^\d{12}$/, /^\d{15}$/, /^\d{20}$/, /^\d{22}$/],
    trackingUrl: (tn) =>
      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tn)}`,
  },
  {
    slug: "dhl",
    name: "DHL",
    patterns: [/^\d{10}$/, /^\d{11}$/, /^JD\d{18}$/i, /^[A-Z]{3}\d{7}$/i],
    trackingUrl: (tn) =>
      `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(tn)}`,
  },
  {
    slug: "usps",
    name: "USPS",
    patterns: [
      /^9[0-9]{21}$/,
      /^9[0-9]{15}$/,
      /^E[A-Z]\d{9}US$/i,
      /^[A-Z]{2}\d{9}US$/i,
    ],
    trackingUrl: (tn) =>
      `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tn)}`,
  },
  {
    slug: "royal_mail",
    name: "Royal Mail",
    patterns: [/^[A-Z]{2}\d{9}GB$/i],
    trackingUrl: (tn) =>
      `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(tn)}`,
  },
  {
    slug: "canada_post",
    name: "Canada Post",
    patterns: [/^[A-Z]{2}\d{9}CA$/i],
    trackingUrl: (tn) =>
      `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${encodeURIComponent(tn)}`,
  },
];

export function detectCarrier(trackingNumber: string): {
  carrier: CarrierSlug;
  confidence: "high" | "low" | "none";
  name: string;
} {
  const cleaned = trackingNumber.trim().replace(/\s+/g, "");
  for (const c of CARRIERS) {
    if (c.patterns.some((p) => p.test(cleaned))) {
      return { carrier: c.slug, confidence: "high", name: c.name };
    }
  }
  // Demo prefixes
  if (/^FDX/i.test(cleaned))
    return { carrier: "fedex", confidence: "high", name: "FedEx" };
  if (/^UPS/i.test(cleaned))
    return { carrier: "ups", confidence: "high", name: "UPS" };
  if (/^DHL/i.test(cleaned))
    return { carrier: "dhl", confidence: "high", name: "DHL" };
  return { carrier: "unknown", confidence: "none", name: "Unknown" };
}

export function carrierDisplayName(slug: CarrierSlug): string {
  return CARRIERS.find((c) => c.slug === slug)?.name ?? slug.toUpperCase();
}

export function carrierTrackingUrl(
  slug: CarrierSlug,
  trackingNumber: string,
): string | null {
  const c = CARRIERS.find((x) => x.slug === slug);
  return c ? c.trackingUrl(trackingNumber) : null;
}
