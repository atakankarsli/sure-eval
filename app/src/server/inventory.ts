export class Inventory {
  private readonly stock = new Map<string, number>();

  constructor(initial: Record<string, number>) {
    for (const [sku, quantity] of Object.entries(initial)) {
      this.stock.set(sku, quantity);
    }
  }

  available(sku: string): number {
    return this.stock.get(sku) ?? 0;
  }

  take(sku: string, quantity: number): void {
    this.stock.set(sku, this.available(sku) - quantity);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.stock);
  }
}
