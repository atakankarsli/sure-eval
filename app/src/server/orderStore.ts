import type { Order } from "../domain/orders";

export class OrderStore {
  private readonly orders: Order[] = [];

  add(order: Order): void {
    this.orders.push(order);
  }

  all(): Order[] {
    return [...this.orders];
  }
}
