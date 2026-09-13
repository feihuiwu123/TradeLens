import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/server/store/memory";
import { normalizeKeyword, type TradeStore } from "@/server/store/types";

let store: TradeStore;

const row = (over: Partial<Parameters<TradeStore["saveListingSnapshots"]>[0][0]> = {}) => ({
  marketCode: "US",
  keyword: "wireless earbuds",
  asin: "B0CHWRXH8B",
  title: "Test earbuds",
  price: 19.99,
  currency: "USD",
  rating: 4.5,
  reviewCount: 100,
  url: "https://www.amazon.com/dp/B0CHWRXH8B",
  source: "test",
  ...over,
});

describe("检索词归一化", () => {
  it("大小写与多余空格不应导致缓存未命中", () => {
    expect(normalizeKeyword("  Wireless   Earbuds ")).toBe("wireless earbuds");
    expect(normalizeKeyword("WIRELESS EARBUDS")).toBe(normalizeKeyword("wireless earbuds"));
  });
});

describe("商品快照", () => {
  beforeEach(() => {
    // createMemoryStore 在非 production 下会复用 globalThis 上的实例以扛热重载，
    // 测试里必须清掉，否则用例之间会串数据
    delete (globalThis as { __tradeLensMemoryStore?: unknown }).__tradeLensMemoryStore;
    store = createMemoryStore();
  });

  it("写入后可按市场与关键词读回", async () => {
    await store.saveListingSnapshots([row()]);
    const got = await store.getListingSnapshots({
      marketCode: "US",
      keyword: "wireless earbuds",
      maxAgeMs: 60_000,
    });
    expect(got).toHaveLength(1);
    expect(got[0].price).toBe(19.99);
    expect(got[0].url).toContain("/dp/B0CHWRXH8B");
  });

  it("关键词大小写不同仍能命中", async () => {
    await store.saveListingSnapshots([row()]);
    const got = await store.getListingSnapshots({
      marketCode: "US",
      keyword: "  WIRELESS  Earbuds ",
      maxAgeMs: 60_000,
    });
    expect(got).toHaveLength(1);
  });

  it("不同市场互不串台", async () => {
    await store.saveListingSnapshots([row(), row({ marketCode: "DE", price: 21.9, currency: "EUR" })]);
    const us = await store.getListingSnapshots({ marketCode: "US", keyword: "wireless earbuds", maxAgeMs: 60_000 });
    const de = await store.getListingSnapshots({ marketCode: "DE", keyword: "wireless earbuds", maxAgeMs: 60_000 });
    expect(us[0].price).toBe(19.99);
    expect(de[0].price).toBe(21.9);
  });

  it("同一商品重复抓取只更新价格，不产生重复行", async () => {
    await store.saveListingSnapshots([row({ price: 19.99 })]);
    await store.saveListingSnapshots([row({ price: 17.5 })]);
    const got = await store.getListingSnapshots({ marketCode: "US", keyword: "wireless earbuds", maxAgeMs: 60_000 });
    expect(got).toHaveLength(1);
    expect(got[0].price).toBe(17.5);
  });

  it("超过 TTL 的快照不再返回——宁可重抓，不可给过期价", async () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000);
    await store.saveListingSnapshots([row({ fetchedAt: old })]);
    const fresh = await store.getListingSnapshots({
      marketCode: "US",
      keyword: "wireless earbuds",
      maxAgeMs: 6 * 60 * 60 * 1000,
    });
    expect(fresh).toHaveLength(0);
    // 放宽 TTL 后又能读到，说明数据还在、只是被判过期
    const loose = await store.getListingSnapshots({
      marketCode: "US",
      keyword: "wireless earbuds",
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
    expect(loose).toHaveLength(1);
  });

  it("未命中返回空数组而不是抛错", async () => {
    const got = await store.getListingSnapshots({ marketCode: "JP", keyword: "没抓过", maxAgeMs: 60_000 });
    expect(got).toEqual([]);
  });

  it("空数组写入是安全的空操作", async () => {
    await expect(store.saveListingSnapshots([])).resolves.toBeUndefined();
  });

  it("可选字段缺失时存为 null，不编造默认值", async () => {
    await store.saveListingSnapshots([row({ rating: null, reviewCount: null })]);
    const got = await store.getListingSnapshots({ marketCode: "US", keyword: "wireless earbuds", maxAgeMs: 60_000 });
    expect(got[0].rating).toBeNull();
    expect(got[0].reviewCount).toBeNull();
  });
});
