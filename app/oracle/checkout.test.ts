import { addItem, emptyCart, type Cart } from "../src/domain/cart";
import type { OrderRequest, OrderResult, OrderService } from "../src/domain/orders";
import { createCheckout } from "../src/features/checkout/checkout";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function cartStore(initial: Cart) {
  let cart = initial;
  return { get: () => cart, set: (next: Cart) => (cart = next) };
}

function filledCart(): Cart {
  return addItem(addItem(emptyCart(), "TEA-1", 2), "CUP-1", 1);
}

function serviceReturning(result: OrderResult | Error) {
  const calls: OrderRequest[] = [];
  const service: OrderService = {
    async placeOrder(request) {
      calls.push(request);
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { service, calls };
}

const failures: Array<[string, OrderResult | Error]> = [
  ["a failure result", { ok: false, error: "out_of_stock" }],
  ["a thrown request", new Error("network down")],
];

describe("checkout.failure", () => {
  for (const [name, outcome] of failures) {
    it(`CHK-001 keeps cart items and quantities after ${name}`, async () => {
      const cart = cartStore(filledCart());
      const checkout = createCheckout({ service: serviceReturning(outcome).service, cart });
      await checkout.submit();
      expect(cart.get()).toEqual(filledCart());
    });

    it(`CHK-002 does not enter success after ${name}`, async () => {
      const checkout = createCheckout({ service: serviceReturning(outcome).service, cart: cartStore(filledCart()) });
      await checkout.submit();
      expect(checkout.state.status).not.toBe("success");
    });

    it(`CHK-003 clears submitting after ${name}`, async () => {
      const checkout = createCheckout({ service: serviceReturning(outcome).service, cart: cartStore(filledCart()) });
      await checkout.submit();
      expect(checkout.state.submitting).toBe(false);
    });
  }

  it("CHK-002 does not enter success after a failure with an empty message", async () => {
    const checkout = createCheckout({
      service: serviceReturning({ ok: false, error: "" }).service,
      cart: cartStore(filledCart()),
    });
    await checkout.submit();
    expect(checkout.state.status).not.toBe("success");
  });

  it("CHK-003 lets the customer submit again after a failure", async () => {
    const { service, calls } = serviceReturning({ ok: false, error: "out_of_stock" });
    const checkout = createCheckout({ service, cart: cartStore(filledCart()) });
    await checkout.submit();
    await checkout.submit();
    expect(calls).toHaveLength(2);
  });

  it("baseline: success clears the cart and records the order", async () => {
    const order = { id: "o1", lines: [], total: 0, createdAt: "2026-10-11T00:00:00.000Z" };
    const cart = cartStore(filledCart());
    const checkout = createCheckout({ service: serviceReturning({ ok: true, order }).service, cart });
    await checkout.submit();
    expect(checkout.state).toMatchObject({ status: "success", submitting: false, order });
    expect(cart.get().lines).toEqual([]);
  });
});

describe("checkout.pending", () => {
  it("CHK-004 a second submit while pending starts no second request", async () => {
    const pending = deferred<OrderResult>();
    const calls: OrderRequest[] = [];
    const service: OrderService = {
      placeOrder(request) {
        calls.push(request);
        return pending.promise;
      },
    };
    const checkout = createCheckout({ service, cart: cartStore(filledCart()) });
    const first = checkout.submit();
    const second = checkout.submit();
    pending.resolve({ ok: false, error: "out_of_stock" });
    await Promise.all([first, second]);
    expect(calls).toHaveLength(1);
  });
});
