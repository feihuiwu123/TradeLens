import type {
  Category,
  CustomsTariff,
  FxRate,
  Market,
  MarketListing,
  PlatformFee,
  Product,
  ShippingRate,
  Subcategory,
} from "@/db/schema";
import {
  categorySeed,
  fxSeed,
  listingSeed,
  marketSeed,
  platformFeeSeed,
  productSeed,
  shippingByMarket,
  shippingMethodSeed,
  tariffByHs,
} from "@/lib/seed-data";
import { subcategorySeed } from "@/lib/taxonomy-seed";
import type { Catalog } from "@/server/store/types";

/**
 * 把 seed-data 里的原始常量转换成带主键的行数据。
 *
 * 主键在这里确定性地分配（按种子数组顺序 1..N），而不是交给数据库的 serial，
 * 这样内存实现与 Postgres 实现产生的 id 完全一致：
 * /products/42 在两种模式下指向同一个商品，测试与分享链接才有意义。
 */
export function buildSeedCatalog(): Catalog {
  const markets: Market[] = marketSeed.map((m, i) => ({ ...m, id: i + 1 }));
  const fx: FxRate[] = fxSeed.map((f, i) => ({ ...f, id: i + 1 }));
  const categories: Category[] = categorySeed.map((c, i) => ({ ...c, id: i + 1 }));

  const marketByCode = new Map(markets.map((m) => [m.code, m]));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const products: Product[] = productSeed.map((p, i) => {
    const category = categoryBySlug.get(p.categorySlug);
    if (!category) throw new Error(`种子数据异常：商品 ${p.sku} 引用了不存在的类目 ${p.categorySlug}`);
    const { categorySlug: _drop, ...rest } = p;
    return { ...rest, id: i + 1, categoryId: category.id };
  });

  const subcategories: Subcategory[] = subcategorySeed.map((s, i) => {
    const category = categoryBySlug.get(s.categorySlug);
    if (!category) throw new Error(`种子数据异常：子类目 ${s.slug} 引用了不存在的类目 ${s.categorySlug}`);
    const { categorySlug: _drop, ...rest } = s;
    return {
      ...rest,
      id: i + 1,
      categoryId: category.id,
      altHsCodes: s.altHsCodes ?? "",
      hsVerified: 0,
      logisticsFlag: s.logisticsFlag ?? "none",
      complianceLevel: s.complianceLevel ?? "ok",
      requiredCerts: s.requiredCerts ?? "",
      note: s.note ?? "",
      keywords: s.keywords ?? "",
    };
  });

  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const listings: MarketListing[] = listingSeed.map((l, i) => {
    const product = productBySku.get(l.sku);
    const market = marketByCode.get(l.market);
    if (!product) throw new Error(`种子数据异常：listing 引用了不存在的 SKU ${l.sku}`);
    if (!market) throw new Error(`种子数据异常：listing 引用了不存在的市场 ${l.market}`);
    const { sku: _sku, market: _market, ...rest } = l;
    return { ...rest, id: i + 1, productId: product.id, marketId: market.id };
  });

  const shipping: ShippingRate[] = [];
  for (const [code, rates] of Object.entries(shippingByMarket)) {
    const market = marketByCode.get(code);
    if (!market) continue;
    for (const rate of rates) {
      const meta = shippingMethodSeed.find((m) => m.method === rate.method);
      shipping.push({
        ...rate,
        id: shipping.length + 1,
        marketId: market.id,
        methodZh: meta?.methodZh ?? rate.method,
        notes: meta?.notes ?? "",
      });
    }
  }

  const tariffs: CustomsTariff[] = [];
  for (const [hsCode, byMarket] of Object.entries(tariffByHs)) {
    for (const [code, tariff] of Object.entries(byMarket)) {
      const market = marketByCode.get(code);
      if (!market) continue;
      tariffs.push({
        id: tariffs.length + 1,
        hsCode,
        marketId: market.id,
        mfnDuty: tariff.mfn,
        extraDuty: tariff.extra,
        vatRate: market.vatRate,
        notes: tariff.note,
      });
    }
  }

  const fees: PlatformFee[] = [];
  for (const fee of platformFeeSeed) {
    for (const code of fee.markets) {
      const market = marketByCode.get(code);
      if (!market) continue;
      fees.push({
        id: fees.length + 1,
        platform: fee.platform,
        marketId: market.id,
        referralRate: fee.referralRate,
        fulfillmentPerUnitUsd: fee.fulfillmentPerUnitUsd,
        paymentFeeRate: fee.paymentFeeRate,
      });
    }
  }

  return { markets, categories, subcategories, products, listings, shipping, tariffs, fees, fx };
}
