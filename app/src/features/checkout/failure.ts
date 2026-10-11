import type { Cart } from "../../domain/cart";
import type { CheckoutState } from "./checkout";

export type CartStore = {
  get(): Cart;
  set(cart: Cart): void;
};

export function applyFailure(state: CheckoutState, error: string, _cart: CartStore): CheckoutState {
  return { ...state, submitting: false, status: "failed", error };
}
