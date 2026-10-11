export type Product = {
  sku: string;
  name: string;
  category: string;
  price: number;
};

export type Page<T> = {
  items: T[];
  page: number;
  pageCount: number;
};

export const PAGE_SIZE = 3;

export const CATALOG: readonly Product[] = [
  { sku: "TEA-1", name: "Sencha", category: "tea", price: 12 },
  { sku: "TEA-2", name: "Assam", category: "tea", price: 9 },
  { sku: "TEA-3", name: "Earl Grey", category: "tea", price: 10 },
  { sku: "TEA-10", name: "Gyokuro", category: "tea", price: 28 },
  { sku: "CUP-1", name: "Glass cup", category: "cups", price: 7 },
  { sku: "CUP-2", name: "Clay cup", category: "cups", price: 15 },
  { sku: "CUP-3", name: "Travel cup", category: "cups", price: 18 },
  { sku: "POT-1", name: "Kyusu", category: "pots", price: 45 },
  { sku: "POT-2", name: "Glass teapot", category: "pots", price: 32 },
  { sku: "POT-3", name: "Cast iron pot", category: "pots", price: 60 },
];

export function findProduct(sku: string): Product | undefined {
  return CATALOG.find((product) => product.sku === sku);
}

export function catalogPrice(sku: string): number | undefined {
  return findProduct(sku)?.price;
}

// Pages are numbered from 1.
export function listProducts(category: string | null, page: number, pageSize = PAGE_SIZE): Page<Product> {
  const matching = category ? CATALOG.filter((product) => product.category === category) : [...CATALOG];
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const start = (page - 1) * pageSize;
  return { items: matching.slice(start, start + pageSize), page, pageCount };
}
