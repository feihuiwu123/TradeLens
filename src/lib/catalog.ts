import { cache } from "react";
import type {
  CustomsTariff,
  FxRate,
  Market,
  MarketListing,
  PlatformFee,
  Product,
  ShippingRate,
} from "@/db/schema";
import { calculateProfit, methodLabel, opportunityScore, pickDefaultMethod, rankOpportunities } from "@/lib/profit";
import { additionalDutyRate } from "@/lib/trade-remedies";
import type { CalcInput, Opportunity, ShippingMethod } from "@/lib/types";
import { getLiveFx } from "@/server/providers/fx-service";
import { getStore } from "@/server/store";
import type { Catalog } from "@/server/store/types";

export type { Catalog } from "@/server/store/types";

/**
 * 用 React cache 按请求去重：布局与页面在同一次渲染里都要读目录，
 * 不去重的话每个页面会把 8 张参考表各查两遍。
 *
 * 汇率会用 ECB 实测值覆盖种子基准值；ECB 不发布的币种（如盯住美元的 AED）
 * 以及取数失败时，保留原有基准值。
 */
export const loadCatalog = cache(async (): Promise<Catalog> => {
  const catalog = await getStore().loadCatalog();
  const live = await getLiveFx(catalog.fx.map((f) => f.currency));
  if (!live) return catalog;

  return {
    ...catalog,
    fx: catalog.fx.map((row) => {
      const rate = live.value[row.currency];
      return rate && rate > 0 ? { ...row, cnyPerUnit: rate } : row;
    }),
  };
});

export function fxMap(fx: FxRate[]) {
  return new Map(fx.map((row) => [row.currency, row.cnyPerUnit]));
}

export function cnyPerUsd(fx: FxRate[]) {
  return fxMap(fx).get("USD") ?? 7.25;
}

export function findTariff(tariffs: CustomsTariff[], hsCode: string, marketId: number) {
  return tariffs.find((t) => t.hsCode === hsCode && t.marketId === marketId);
}

export function findFee(fees: PlatformFee[], platform: string, marketId: number) {
  return (
    fees.find((f) => f.platform === platform && f.marketId === marketId) ??
    fees.find((f) => f.platform === platform) ??
    null
  );
}

export function findShipping(shipping: ShippingRate[], marketId: number, method: ShippingMethod) {
  return shipping.find((s) => s.marketId === marketId && s.method === method);
}

export function vatRecoverable(platform: string, market: Market) {
  if (market.vatRate <= 0) return true;
  if (platform === "Shopify") return false;
  return true;
}

export function buildCalcInput(opts: {
  product: Product;
  market: Market;
  listing: MarketListing;
  shipping: ShippingRate;
  tariff?: CustomsTariff;
  fee?: PlatformFee | null;
  fx: FxRate[];
  quantity?: number;
  adsRate?: number;
  returnRate?: number;
  vatRecoverable?: boolean;
  /** 按哪一天的政策计税，默认今天。回溯历史测算时传入当时日期。 */
  asOf?: Date;
}): CalcInput {
  const cnyUsd = cnyPerUsd(opts.fx);
  const cnyLocal = fxMap(opts.fx).get(opts.market.currency) ?? cnyUsd;

  // 关税三层叠加：MFN 基础税率 + HS 对应的 301 清单税率 + 按原产地生效的贸易救济措施。
  // 前两层来自税则库，第三层来自 trade-remedies（官方税则接口里查不到）。
  const mfn = opts.tariff?.mfnDuty ?? 0;
  const listExtra = opts.tariff?.extraDuty ?? 0;
  const remedy = additionalDutyRate(opts.market.code, opts.asOf ?? new Date());
  const dutyRate = mfn + listExtra + remedy.rate;

  const vatRate = opts.tariff?.vatRate ?? opts.market.vatRate;
  return {
    sourcePriceCny: opts.product.sourcePriceCny,
    quantity: opts.quantity ?? Math.max(opts.product.moq, 50),
    weightKg: opts.product.weightKg,
    volumeCbm: opts.product.volumeCbm,
    sellPriceLocal: opts.listing.sellPrice,
    sellCurrency: opts.market.currency,
    cnyPerSellCurrency: cnyLocal,
    cnyPerUsd: cnyUsd,
    shippingMethod: opts.shipping.method as ShippingMethod,
    ratePerKgUsd: opts.shipping.ratePerKgUsd,
    ratePerCbmUsd: opts.shipping.ratePerCbmUsd,
    minChargeUsd: opts.shipping.minChargeUsd,
    dutyRate,
    vatRate,
    vatRecoverable: opts.vatRecoverable ?? vatRecoverable(opts.listing.platform, opts.market),
    platformReferralRate: opts.fee?.referralRate ?? 0.15,
    fulfillmentPerUnitUsd: opts.fee?.fulfillmentPerUnitUsd ?? 3,
    paymentFeeRate: opts.fee?.paymentFeeRate ?? 0.02,
    adsRate: opts.adsRate ?? 0.08,
    returnRate: opts.returnRate ?? 0.06,
    insuranceRate: 0.004,
    packingPerUnitUsd: 0.18,
    inspectionPerOrderUsd: 40,
  };
}

export function buildOpportunities(catalog: Catalog, methodPref?: ShippingMethod | "auto"): Opportunity[] {
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
  const marketById = new Map(catalog.markets.map((m) => [m.id, m]));
  const items: Opportunity[] = [];

  for (const listing of catalog.listings) {
    const product = catalog.products.find((p) => p.id === listing.productId);
    const market = marketById.get(listing.marketId);
    if (!product || !market) continue;
    const method =
      methodPref && methodPref !== "auto" ? methodPref : pickDefaultMethod(product.weightKg, product.volumeCbm);
    const shipping = findShipping(catalog.shipping, market.id, method);
    if (!shipping) continue;
    const tariff = findTariff(catalog.tariffs, product.hsCode, market.id);
    const fee = findFee(catalog.fees, listing.platform, market.id);
    const input = buildCalcInput({ product, market, listing, shipping, tariff, fee, fx: catalog.fx });
    const result = calculateProfit(input);
    const category = categoryById.get(product.categoryId);
    const score = opportunityScore({
      marginPct: result.marginPct,
      roiPct: result.roiPct,
      demandScore: product.demandScore,
      monthlySales: listing.monthlySales,
      competition: listing.competition,
      logisticsScore: market.logisticsScore,
      daysMax: shipping.daysMax,
      ipRisk: product.ipRisk,
    });
    items.push({
      productId: product.id,
      sku: product.sku,
      nameZh: product.nameZh,
      nameEn: product.nameEn,
      imageUrl: product.imageUrl,
      categorySlug: category?.slug ?? "",
      categoryName: category?.nameZh ?? "",
      hsCode: product.hsCode,
      sourcePriceCny: product.sourcePriceCny,
      supplierPlatform: product.supplierPlatform,
      weightKg: product.weightKg,
      dutyRate: input.dutyRate,
      vatRate: input.vatRate,
      marketId: market.id,
      marketCode: market.code,
      marketName: market.nameZh,
      flag: market.flag,
      platform: listing.platform,
      sellPriceLocal: listing.sellPrice,
      currency: market.currency,
      monthlySales: listing.monthlySales,
      demandScore: product.demandScore,
      competition: listing.competition,
      trend: product.trend,
      shippingMethod: method,
      shippingLabel: methodLabel(method),
      daysMin: shipping.daysMin,
      daysMax: shipping.daysMax,
      result,
      score,
    });
  }

  return rankOpportunities(items);
}

export async function getWatchlistItems() {
  return getStore().listWatchlist();
}

export async function getSavedCalcs() {
  return getStore().listSavedCalcs();
}

export async function getProductById(id: number) {
  const catalog = await loadCatalog();
  return catalog.products.find((p) => p.id === id) ?? null;
}

export function marketByCode(catalog: Catalog, code: string) {
  return catalog.markets.find((m) => m.code === code);
}
