export type CatalogQuery = {
  category: string | null;
  page: number;
};

export function initialQuery(): CatalogQuery {
  return { category: null, page: 1 };
}

export function nextPage(query: CatalogQuery): CatalogQuery {
  return { ...query, page: query.page + 1 };
}

export function withCategory(query: CatalogQuery, category: string | null): CatalogQuery {
  return { category, page: 1 };
}

export function serializeQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  if (query.category) {
    params.set("category", query.category);
  }
  return params.toString();
}
