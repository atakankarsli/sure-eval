import { Inventory } from "../src/server/inventory";
import { OrderStore } from "../src/server/orderStore";
import { createOrderService } from "../src/server/orderService";

function setup() {
  const inventory = new Inventory({ "TEA-1": 5, "CUP-1": 1, "POT-1": 2 });
  const store = new OrderStore();
  let n = 0;
  const service = createOrderService({
    inventory,
    store,
    now: () => new Date("2026-10-11T12:00:00.000Z"),
    nextId: () => `order-${++n}`,
  });
  return { inventory, store, service };
}

describe("orders.validation", () => {
  it("ORD-001 a later short line rejects the order and changes no stock", async () => {
    const { inventory, service } = setup();
    const before = inventory.snapshot();
    const result = await service.placeOrder({
      lines: [
        { sku: "TEA-1", quantity: 2 },
        { sku: "CUP-1", quantity: 3 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(inventory.snapshot()).toEqual(before);
  });

  it("ORD-002 committed prices come from the catalog, not the client", async () => {
    const { store, service } = setup();
    const result = await service.placeOrder({ lines: [{ sku: "POT-1", quantity: 1, clientPrice: 1 }] });
    expect(result.ok).toBe(true);
    expect(store.all()[0].lines[0].unitPrice).toBe(45);
    expect(store.all()[0].total).toBe(45);
  });

  it("ORD-003 a rejected order commits nothing", async () => {
    const { store, service } = setup();
    expect((await service.placeOrder({ lines: [{ sku: "NOPE-9", quantity: 1 }] })).ok).toBe(false);
    expect((await service.placeOrder({ lines: [] })).ok).toBe(false);
    expect(store.all()).toEqual([]);
  });

  it("baseline: a valid order takes stock once and is stored", async () => {
    const { inventory, store, service } = setup();
    const result = await service.placeOrder({ lines: [{ sku: "TEA-1", quantity: 2 }] });
    expect(result.ok).toBe(true);
    expect(inventory.available("TEA-1")).toBe(3);
    expect(store.all()).toHaveLength(1);
  });
});
