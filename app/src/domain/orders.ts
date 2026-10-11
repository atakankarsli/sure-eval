export type OrderLineRequest = {
  sku: string;
  quantity: number;
  clientPrice?: number;
};

export type OrderRequest = {
  lines: OrderLineRequest[];
};

export type OrderLine = {
  sku: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  total: number;
  createdAt: string;
};

export type OrderResult = { ok: true; order: Order } | { ok: false; error: string };

export interface OrderService {
  placeOrder(request: OrderRequest): Promise<OrderResult>;
}

export function orderOf(result: OrderResult): Order | null {
  return result.ok ? result.order : null;
}
