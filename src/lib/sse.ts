type Listener = (shipmentId: string) => void;

const listeners = new Set<Listener>();

export function subscribeShipmentUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishShipmentUpdate(shipmentId: string): void {
  for (const listener of listeners) {
    try {
      listener(shipmentId);
    } catch {
      // isolate subscriber errors
    }
  }
}
