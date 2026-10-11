export type CartLine = {
  sku: string;
  quantity: number;
};

export type Cart = {
  lines: CartLine[];
};

export function emptyCart(): Cart {
  return { lines: [] };
}

export function addItem(cart: Cart, sku: string, quantity: number): Cart {
  const existing = cart.lines.find((line) => line.sku === sku);
  if (existing) {
    return {
      lines: cart.lines.map((line) => (line.sku === sku ? { ...line, quantity: line.quantity + quantity } : line)),
    };
  }
  return { lines: [...cart.lines, { sku, quantity }] };
}

export function removeItem(cart: Cart, sku: string): Cart {
  return { lines: cart.lines.filter((line) => line.sku !== sku) };
}

export function itemCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}
