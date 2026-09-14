export const CANONICAL_STATUSES = [
  "pending",
  "label_created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "available_for_pickup",
  "failed_attempt",
  "delivered",
  "exception",
  "customs_hold",
  "returned",
  "expired",
  "cancelled",
] as const;

export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

/** Monotonic rank — higher wins; terminal states lock the shipment. */
const RANK: Record<CanonicalStatus, number> = {
  pending: 0,
  label_created: 10,
  picked_up: 20,
  in_transit: 30,
  out_for_delivery: 40,
  available_for_pickup: 40,
  failed_attempt: 35,
  customs_hold: 32,
  exception: 33,
  delivered: 100,
  returned: 90,
  expired: 80,
  cancelled: 80,
};

const TERMINAL: ReadonlySet<CanonicalStatus> = new Set([
  "delivered",
  "returned",
  "expired",
  "cancelled",
]);

export function isTerminal(status: CanonicalStatus): boolean {
  return TERMINAL.has(status);
}

/** Never regress past delivered/returned; allow exception side-branches carefully. */
export function mergeStatus(
  current: CanonicalStatus,
  incoming: CanonicalStatus,
): CanonicalStatus {
  if (isTerminal(current) && current === "delivered") return current;
  if (current === "returned" && incoming !== "delivered") return current;
  if (RANK[incoming] >= RANK[current]) return incoming;
  // Side-branch statuses that should still surface even if rank is lower
  if (
    (incoming === "exception" ||
      incoming === "customs_hold" ||
      incoming === "failed_attempt") &&
    !isTerminal(current)
  ) {
    return incoming;
  }
  return current;
}

export const STATUS_LABELS: Record<CanonicalStatus, string> = {
  pending: "Awaiting updates",
  label_created: "Label created",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  available_for_pickup: "Available for pickup",
  failed_attempt: "Delivery attempted",
  delivered: "Delivered",
  exception: "Exception",
  customs_hold: "Held in customs",
  returned: "Returning to sender",
  expired: "Tracking expired",
  cancelled: "Cancelled",
};

export const MILESTONE_STEPS: CanonicalStatus[] = [
  "label_created",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

export function milestoneIndex(status: CanonicalStatus): number {
  if (status === "picked_up") return 1;
  if (status === "available_for_pickup" || status === "failed_attempt") return 2;
  if (status === "customs_hold" || status === "exception") return 1;
  const idx = MILESTONE_STEPS.indexOf(status);
  if (idx >= 0) return idx;
  if (status === "returned") return 3;
  return 0;
}
