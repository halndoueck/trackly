import type { CanonicalStatus } from "./status";

/** AfterShip tag → canonical */
export const AFTERSHIP_TAG_MAP: Record<string, CanonicalStatus> = {
  Pending: "pending",
  InfoReceived: "label_created",
  InTransit: "in_transit",
  OutForDelivery: "out_for_delivery",
  AttemptFail: "failed_attempt",
  Delivered: "delivered",
  AvailableForPickup: "available_for_pickup",
  Exception: "exception",
  Expired: "expired",
};

/** EasyPost status → canonical */
export const EASYPOST_STATUS_MAP: Record<string, CanonicalStatus> = {
  unknown: "pending",
  pre_transit: "label_created",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  available_for_pickup: "available_for_pickup",
  return_to_sender: "returned",
  failure: "exception",
  cancelled: "cancelled",
  error: "exception",
};

/** FedEx scan codes (common) */
export const FEDEX_CODE_MAP: Record<string, CanonicalStatus> = {
  OC: "label_created",
  PU: "picked_up",
  IT: "in_transit",
  AR: "in_transit",
  DP: "in_transit",
  OD: "out_for_delivery",
  DL: "delivered",
  DE: "exception",
  SE: "exception",
  HL: "available_for_pickup",
  CA: "customs_hold",
};

/** UPS activity codes (simplified) */
export const UPS_CODE_MAP: Record<string, CanonicalStatus> = {
  M: "label_created",
  P: "picked_up",
  I: "in_transit",
  O: "out_for_delivery",
  D: "delivered",
  X: "exception",
  RS: "returned",
};

export function mapAfterShipTag(tag: string): CanonicalStatus {
  return AFTERSHIP_TAG_MAP[tag] ?? "in_transit";
}

export function mapEasyPostStatus(status: string): CanonicalStatus {
  return EASYPOST_STATUS_MAP[status] ?? "pending";
}

export function mapFedExCode(code: string): CanonicalStatus {
  return FEDEX_CODE_MAP[code.toUpperCase()] ?? "in_transit";
}

export function mapUpsCode(code: string): CanonicalStatus {
  return UPS_CODE_MAP[code.toUpperCase()] ?? "in_transit";
}

export function inferSubstatus(
  message: string,
  status: CanonicalStatus,
): string | null {
  const m = message.toLowerCase();
  if (m.includes("customs")) return "customs_hold";
  if (m.includes("return to sender") || m.includes("returning"))
    return "return_to_sender";
  if (m.includes("weather") || m.includes("delay")) return "delayed";
  if (m.includes("address")) return "address_issue";
  if (status === "failed_attempt") return "delivery_attempted";
  return null;
}
