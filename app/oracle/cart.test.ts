import { addItem, emptyCart, removeItem } from "../src/domain/cart";

describe("cart.lines", () => {
  it("CART-001 removing a SKU keeps every other line", () => {
    let cart = emptyCart();
    cart = addItem(cart, "TEA-1", 2);
    cart = addItem(cart, "TEA-10", 1);
    cart = addItem(cart, "CUP-2", 3);
    expect(removeItem(cart, "TEA-1").lines).toEqual([
      { sku: "TEA-10", quantity: 1 },
      { sku: "CUP-2", quantity: 3 },
    ]);
  });

  it("CART-002 adding an existing SKU increments its quantity", () => {
    const cart = addItem(addItem(emptyCart(), "POT-1", 2), "POT-1", 3);
    expect(cart.lines).toEqual([{ sku: "POT-1", quantity: 5 }]);
  });
});
