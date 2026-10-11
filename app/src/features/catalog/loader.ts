import type { Product } from "../../domain/catalog";
import type { FetchPage } from "./api";
import { initialQuery, nextPage, withCategory, type CatalogQuery } from "./query";

export type CatalogState = {
  query: CatalogQuery;
  items: Product[];
  pageCount: number;
  loading: boolean;
};

export function createCatalogLoader(fetchPage: FetchPage) {
  let generation = 0;
  let state: CatalogState = { query: initialQuery(), items: [], pageCount: 1, loading: false };

  async function load(query: CatalogQuery): Promise<void> {
    const requestId = ++generation;
    state = { ...state, query, loading: true };
    const page = await fetchPage(query);
    if (requestId === generation) {
      state = { query, items: page.items, pageCount: page.pageCount, loading: false };
    }
  }

  return {
    get state(): CatalogState {
      return state;
    },
    load,
    next(): Promise<void> {
      return load(nextPage(state.query));
    },
    filter(category: string | null): Promise<void> {
      return load(withCategory(state.query, category));
    },
  };
}
