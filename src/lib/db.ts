import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { CanonicalStatus } from "./status";
import { mergeStatus } from "./status";
import type {
  CarrierSlug,
  CheckpointRow,
  Location,
  ShipmentRow,
  TrackingEventInput,
  TrackingSnapshot,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "trackly.sqlite");

let dbInstance: Database.Database | null = null;

function ensureDb(): Database.Database {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      tracking_number TEXT NOT NULL,
      carrier TEXT NOT NULL,
      status TEXT NOT NULL,
      substatus TEXT,
      status_detail TEXT,
      origin_json TEXT,
      destination_json TEXT,
      last_location_json TEXT,
      estimated_delivery_from TEXT,
      estimated_delivery_to TEXT,
      actual_delivery_at TEXT,
      provider TEXT NOT NULL,
      provider_tracker_id TEXT,
      order_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tn_carrier
      ON shipments(tracking_number, carrier);
    CREATE INDEX IF NOT EXISTS idx_shipments_tn ON shipments(tracking_number);

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL UNIQUE,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL,
      substatus TEXT,
      message TEXT NOT NULL,
      location_json TEXT,
      raw_code TEXT,
      raw_description TEXT,
      source TEXT NOT NULL,
      raw_payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoints_shipment
      ON checkpoints(shipment_id, occurred_at DESC);

    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      received_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbound_deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      status_code INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sse_subscribers (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createShipment(input: {
  trackingNumber: string;
  carrier: CarrierSlug;
  provider?: string;
  providerTrackerId?: string | null;
  orderId?: string | null;
  origin?: Location | null;
  destination?: Location | null;
  estimatedDeliveryFrom?: string | null;
  estimatedDeliveryTo?: string | null;
}): ShipmentRow {
  const db = ensureDb();
  const existing = db
    .prepare(
      `SELECT * FROM shipments WHERE tracking_number = ? AND carrier = ?`,
    )
    .get(input.trackingNumber, input.carrier) as ShipmentRow | undefined;
  if (existing) return existing;

  const row: ShipmentRow = {
    id: nanoid(),
    tracking_number: input.trackingNumber,
    carrier: input.carrier,
    status: "pending",
    substatus: null,
    status_detail: null,
    origin_json: input.origin ? JSON.stringify(input.origin) : null,
    destination_json: input.destination
      ? JSON.stringify(input.destination)
      : null,
    last_location_json: null,
    estimated_delivery_from: input.estimatedDeliveryFrom ?? null,
    estimated_delivery_to: input.estimatedDeliveryTo ?? null,
    actual_delivery_at: null,
    provider: input.provider ?? "demo",
    provider_tracker_id: input.providerTrackerId ?? null,
    order_id: input.orderId ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  db.prepare(
    `INSERT INTO shipments (
      id, tracking_number, carrier, status, substatus, status_detail,
      origin_json, destination_json, last_location_json,
      estimated_delivery_from, estimated_delivery_to, actual_delivery_at,
      provider, provider_tracker_id, order_id, created_at, updated_at
    ) VALUES (
      @id, @tracking_number, @carrier, @status, @substatus, @status_detail,
      @origin_json, @destination_json, @last_location_json,
      @estimated_delivery_from, @estimated_delivery_to, @actual_delivery_at,
      @provider, @provider_tracker_id, @order_id, @created_at, @updated_at
    )`,
  ).run(row);

  return row;
}

export function getShipmentByTracking(
  trackingNumber: string,
  carrier?: CarrierSlug,
): ShipmentRow | null {
  const db = ensureDb();
  if (carrier) {
    return (
      (db
        .prepare(
          `SELECT * FROM shipments WHERE tracking_number = ? AND carrier = ?`,
        )
        .get(trackingNumber, carrier) as ShipmentRow | undefined) ?? null
    );
  }
  return (
    (db
      .prepare(
        `SELECT * FROM shipments WHERE tracking_number = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(trackingNumber) as ShipmentRow | undefined) ?? null
  );
}

export function getShipmentById(id: string): ShipmentRow | null {
  const db = ensureDb();
  return (
    (db.prepare(`SELECT * FROM shipments WHERE id = ?`).get(id) as
      | ShipmentRow
      | undefined) ?? null
  );
}

export function listCheckpoints(shipmentId: string): CheckpointRow[] {
  const db = ensureDb();
  return db
    .prepare(
      `SELECT * FROM checkpoints WHERE shipment_id = ? ORDER BY occurred_at DESC, received_at DESC`,
    )
    .all(shipmentId) as CheckpointRow[];
}

export function claimWebhookEvent(
  eventId: string,
  provider: string,
  payload: unknown,
): boolean {
  const db = ensureDb();
  try {
    db.prepare(
      `INSERT INTO webhook_events (event_id, provider, received_at, payload_json)
       VALUES (?, ?, ?, ?)`,
    ).run(eventId, provider, nowIso(), JSON.stringify(payload));
    return true;
  } catch {
    return false; // duplicate
  }
}

export function appendTrackingEvent(
  shipmentId: string,
  event: TrackingEventInput,
): { inserted: boolean; shipment: ShipmentRow } {
  const db = ensureDb();
  const shipment = getShipmentById(shipmentId);
  if (!shipment) throw new Error("Shipment not found");

  const eventId =
    event.eventId ??
    `${event.source}:${shipment.tracking_number}:${event.occurredAt}:${event.status}:${event.rawCode ?? ""}:${event.message}`;

  const insert = db.prepare(
    `INSERT INTO checkpoints (
      id, shipment_id, event_id, occurred_at, received_at, status, substatus,
      message, location_json, raw_code, raw_description, source, raw_payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = true;
  try {
    insert.run(
      nanoid(),
      shipmentId,
      eventId,
      event.occurredAt,
      nowIso(),
      event.status,
      event.substatus ?? null,
      event.message,
      event.location ? JSON.stringify(event.location) : null,
      event.rawCode ?? null,
      event.rawDescription ?? null,
      event.source,
      event.rawPayload ? JSON.stringify(event.rawPayload) : null,
    );
  } catch {
    inserted = false;
  }

  const nextStatus = mergeStatus(
    shipment.status as CanonicalStatus,
    event.status,
  );
  const updates: Partial<ShipmentRow> = {
    status: nextStatus,
    updated_at: nowIso(),
  };
  if (event.substatus) updates.substatus = event.substatus;
  if (event.message && (event.status === "exception" || event.status === "customs_hold")) {
    updates.status_detail = event.message;
  }
  if (event.location) {
    updates.last_location_json = JSON.stringify(event.location);
  }
  if (nextStatus === "delivered" && !shipment.actual_delivery_at) {
    updates.actual_delivery_at = event.occurredAt;
  }

  db.prepare(
    `UPDATE shipments SET
      status = COALESCE(@status, status),
      substatus = COALESCE(@substatus, substatus),
      status_detail = COALESCE(@status_detail, status_detail),
      last_location_json = COALESCE(@last_location_json, last_location_json),
      actual_delivery_at = COALESCE(@actual_delivery_at, actual_delivery_at),
      updated_at = @updated_at
     WHERE id = @id`,
  ).run({
    id: shipmentId,
    status: updates.status ?? null,
    substatus: updates.substatus ?? null,
    status_detail: updates.status_detail ?? null,
    last_location_json: updates.last_location_json ?? null,
    actual_delivery_at: updates.actual_delivery_at ?? null,
    updated_at: updates.updated_at!,
  });

  const refreshed = getShipmentById(shipmentId)!;
  return { inserted, shipment: refreshed };
}

export function updateShipmentEstimates(
  shipmentId: string,
  from: string | null,
  to: string | null,
): void {
  const db = ensureDb();
  db.prepare(
    `UPDATE shipments SET estimated_delivery_from = ?, estimated_delivery_to = ?, updated_at = ? WHERE id = ?`,
  ).run(from, to, nowIso(), shipmentId);
}

export function toSnapshot(shipment: ShipmentRow): TrackingSnapshot {
  const checkpoints = listCheckpoints(shipment.id);
  return {
    id: shipment.id,
    trackingNumber: shipment.tracking_number,
    carrier: shipment.carrier as CarrierSlug,
    status: shipment.status as CanonicalStatus,
    substatus: shipment.substatus,
    statusDetail: shipment.status_detail,
    origin: parseJson<Location>(shipment.origin_json),
    destination: parseJson<Location>(shipment.destination_json),
    lastLocation: parseJson<Location>(shipment.last_location_json),
    estimatedDelivery:
      shipment.estimated_delivery_from || shipment.estimated_delivery_to
        ? {
            from: shipment.estimated_delivery_from,
            to: shipment.estimated_delivery_to,
          }
        : null,
    actualDeliveryAt: shipment.actual_delivery_at,
    provider: shipment.provider,
    orderId: shipment.order_id,
    createdAt: shipment.created_at,
    updatedAt: shipment.updated_at,
    checkpoints: checkpoints.map((c) => ({
      id: c.id,
      eventId: c.event_id,
      occurredAt: c.occurred_at,
      status: c.status as CanonicalStatus,
      substatus: c.substatus,
      message: c.message,
      location: parseJson<Location>(c.location_json),
      rawCode: c.raw_code,
      source: c.source,
    })),
  };
}

export function recordOutboundDelivery(input: {
  eventId: string;
  url: string;
  statusCode?: number | null;
  attempts?: number;
  lastError?: string | null;
  delivered?: boolean;
}): void {
  const db = ensureDb();
  const existing = db
    .prepare(`SELECT id FROM outbound_deliveries WHERE event_id = ?`)
    .get(input.eventId) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE outbound_deliveries SET
        status_code = COALESCE(?, status_code),
        attempts = ?,
        last_error = ?,
        delivered_at = CASE WHEN ? THEN COALESCE(delivered_at, ?) ELSE delivered_at END
       WHERE event_id = ?`,
    ).run(
      input.statusCode ?? null,
      input.attempts ?? 1,
      input.lastError ?? null,
      input.delivered ? 1 : 0,
      nowIso(),
      input.eventId,
    );
    return;
  }
  db.prepare(
    `INSERT INTO outbound_deliveries
      (id, event_id, url, status_code, attempts, last_error, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    input.eventId,
    input.url,
    input.statusCode ?? null,
    input.attempts ?? 1,
    input.lastError ?? null,
    nowIso(),
    input.delivered ? nowIso() : null,
  );
}

export function getDbPath(): string {
  return DB_PATH;
}
