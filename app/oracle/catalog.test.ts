import { listProducts, type Page, type Product } from "../src/domain/catalog";
import { createCatalogApi } from "../src/features/catalog/api";
import { createCatalogLoader } from "../src/features/catalog/loader";
import type { CatalogQuery } from "../src/features/catalog/query";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("catalog.query", () => {
  it("CAT-001 the next page keeps the selected category", async () => {
    const api = createCatalogApi();
    const seen: CatalogQuery[] = [];
    const loader = createCatalogLoader(async (query) => {
      seen.push(query);
      return api(query);
    });
    await loader.filter("tea");
    await loader.next();
    expect(seen.at(-1)).toEqual({ category: "tea", page: 2 });
    expect(loader.state.items.length).toBeGreaterThan(0);
    expect(loader.state.items.every((item) => item.category === "tea")).toBe(true);
  });

  it("CAT-002 changing the category returns to page one", async () => {
    const loader = createCatalogLoader(createCatalogApi());
    await loader.load({ category: null, page: 3 });
    await loader.filter("cups");
    expect(loader.state.query).toEqual({ category: "cups", page: 1 });
    expect(loader.state.items.map((item) => item.sku)).toEqual(["CUP-1", "CUP-2", "CUP-3"]);
  });

  it("CAT-003 an older response never replaces a newer one", async () => {
    const slow = deferred<Page<Product>>();
    const fast = deferred<Page<Product>>();
    const loader = createCatalogLoader((query) => (query.category === "pots" ? slow.promise : fast.promise));
    const older = loader.filter("pots");
    const newer = loader.filter("cups");
    fast.resolve(listProducts("cups", 1));
    await newer;
    slow.resolve(listProducts("pots", 1));
    await older;
    expect(loader.state.query.category).toBe("cups");
    expect(loader.state.items.every((item) => item.category === "cups")).toBe(true);
  });
});
