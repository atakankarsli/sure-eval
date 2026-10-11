import { catalogPrice } from "../domain/catalog";
import type { Order, OrderRequest, OrderService } from "../domain/orders";
import type { Inventory } from "./inventory";
import type { OrderStore } from "./orderStore";

export type OrderServiceDeps = {
  inventory: Inventory;
  store: OrderStore;
  now: () => Date;
  nextId: () => string;
};

type Validation = { ok: true } | { ok: false; error: string };

export function validateOrder(request: OrderRequest, inventory: Inventory): Validation {
  if (request.lines.length === 0) {
    return { ok: false, error: "empty_order" };
  }
  for (const line of request.lines) {
    if (catalogPrice(line.sku) === undefined) {
      return { ok: false, error: `unknown_sku:${line.sku}` };
    }
    if (line.quantity <= 0) {
      return { ok: false, error: "invalid_quantity" };
    }
    if (inventory.available(line.sku) < line.quantity) {
      return { ok: false, error: `insufficient_stock:${line.sku}` };
    }
  }
  return { ok: true };
}

export function createOrderService(deps: OrderServiceDeps): OrderService {
  return {
    async placeOrder(request) {
      const validation = validateOrder(request, deps.inventory);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }
      const lines = request.lines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: catalogPrice(line.sku) ?? 0,
      }));
      const order: Order = {
        id: deps.nextId(),
        lines,
        total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
        createdAt: deps.now().toISOString(),
      };
      for (const line of request.lines) {
        deps.inventory.take(line.sku, line.quantity);
      }
      deps.store.add(order);
      return { ok: true, order };
    },
  };
}
