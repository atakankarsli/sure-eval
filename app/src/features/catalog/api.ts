import { listProducts, type Page, type Product } from "../../domain/catalog";
import { serializeQuery, type CatalogQuery } from "./query";

export type FetchPage = (query: CatalogQuery) => Promise<Page<Product>>;

// Stands in for GET /api/products?<query>: the request carries only the
// serialized query string.
export function createCatalogApi(): FetchPage {
  return async (query) => {
    const params = new URLSearchParams(serializeQuery(query));
    return listProducts(params.get("category"), Number(params.get("page") ?? "1"));
  };
}
