import { emptyCart } from "../../domain/cart";
import { orderOf, type Order, type OrderResult, type OrderService } from "../../domain/orders";
import { applyFailure, type CartStore } from "./failure";

export type CheckoutState = {
  submitting: boolean;
  status: "idle" | "success" | "failed";
  error: string | null;
  order: Order | null;
};

export function createCheckout(deps: { service: OrderService; cart: CartStore }) {
  let state: CheckoutState = { submitting: false, status: "idle", error: null, order: null };

  return {
    get state(): CheckoutState {
      return state;
    },
    async submit(): Promise<void> {
      if (state.submitting) {
        return;
      }
      state = { ...state, submitting: true, error: null };
      const cart = deps.cart.get();
      let result: OrderResult;
      try {
        result = await deps.service.placeOrder({
          lines: cart.lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
        });
      } catch {
        state = { ...state, submitting: false, status: "failed", error: "network_error" };
        return;
      }
      if (!result.ok) {
        state = applyFailure(state, result.error, deps.cart);
        return;
      }
      deps.cart.set(emptyCart());
      state = { submitting: false, status: "success", error: null, order: orderOf(result) };
    },
  };
}
