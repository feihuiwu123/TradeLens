import type { Catalog } from "@/server/store/types";
import { buildCalcInput, cnyPerUsd, findFee, findShipping, findTariff, fxMap } from "@/lib/catalog";
import { calculateProfit, gradeOf, pickDefaultMethod } from "@/lib/profit";
import type { CalcResult, ShippingMethod } from "@/lib/types";

/** Amazon 各站域名。ASIN 是分站点的，跨市场必须按站点分别解析商品。 */
export const AMAZON_HOSTS: Record<string, string> = {
  US: "amazon.com",
  CA: "amazon.ca",
  UK: "amazon.co.uk",
  DE: "amazon.de",
  FR: "amazon.fr",
  JP: "amazon.co.jp",
  AU: "amazon.com.au",
  SG: "amazon.sg",
  AE: "amazon.ae",
  MX: "amazon.com.mx",
  BR: "amazon.com.br",
};

/** 待测算的中国货源。不落库，按需构造。 */
export type SourceProbe = {
  nameZh: string;
  sourcePriceCny: number;
  weightKg: number;
  volumeCbm: number;
  hsCode: string;
  moq?: number;
};

/** 某个市场上抓到的在售价 */
export type MarketQuote = {
  marketCode: string;
  platform: string;
  /** 当地币种计价的售价 */
  sellPrice: number;
  currency?: string;
  title?: string;
  rating?: number | null;
  reviewCount?: number | null;
  /** 数据来源标注，直接展示给用户 */
  source: string;
  url?: string;
};

export type SpreadRow = {
  marketCode: string;
  marketName: string;
  flag: string;
  platform: string;
  currency: string;
  sellPriceLocal: number;
  sellPriceCny: number;
  sourcePriceCny: number;
  /** 毛差价率：(海外售价 − 采购价) / 采购价 */
  grossSpreadPct: number;
  shippingMethod: ShippingMethod;
  shippingLabel: string;
  dutyRate: number;
  vatRate: number;
  result: CalcResult;
  netProfitCny: number;
  grade: ReturnType<typeof gradeOf>;
  source: string;
  url?: string;
  title?: string;
  /** 该市场的小额免税门槛，低于此值可免税清关 */
  deMinimisUsd: number;
  /** 售价是否低于免税门槛 */
  underDeMinimis: boolean;
};

export type SpreadReport = {
  probe: SourceProbe;
  rows: SpreadRow[];
  /** 未能测算的市场及原因，必须回报而不是静默丢弃 */
  skipped: { marketCode: string; reason: string }[];
  best: SpreadRow | null;
};

/**
 * 价差发现核心。
 *
 * 注意毛差价率和净利率是两个完全不同的东西：
 * 毛差价 500% 的商品在扣掉运费、关税、平台费、广告和退货后经常是亏的。
 * 排序一律按净利，毛差价只作为展示参考——这正是本产品要纠正的行业误区。
 */
export function discoverSpread(
  catalog: Catalog,
  probe: SourceProbe,
  quotes: MarketQuote[],
  opts: { methodPref?: ShippingMethod | "auto"; asOf?: Date } = {},
): SpreadReport {
  const rate = cnyPerUsd(catalog.fx);
  const fx = fxMap(catalog.fx);
  const rows: SpreadRow[] = [];
  const skipped: SpreadReport["skipped"] = [];

  for (const q of quotes) {
    const market = catalog.markets.find((m) => m.code === q.marketCode);
    if (!market) {
      skipped.push({ marketCode: q.marketCode, reason: "未收录该市场的税率与物流参数" });
      continue;
    }
    if (!(q.sellPrice > 0)) {
      skipped.push({ marketCode: q.marketCode, reason: "抓到的售价为 0 或无效" });
      continue;
    }

    const method =
      opts.methodPref && opts.methodPref !== "auto"
        ? opts.methodPref
        : pickDefaultMethod(probe.weightKg, probe.volumeCbm);
    const shipping = findShipping(catalog.shipping, market.id, method);
    if (!shipping) {
      skipped.push({ marketCode: q.marketCode, reason: `缺少 ${method} 运价` });
      continue;
    }

    const tariff = findTariff(catalog.tariffs, probe.hsCode, market.id);
    const fee = findFee(catalog.fees, q.platform, market.id);

    const input = buildCalcInput({
      product: {
        // 合成一条商品记录喂给既有精算内核，避免为按需测算复制一份计算逻辑
        id: 0,
        sku: "PROBE",
        nameZh: probe.nameZh,
        nameEn: "",
        categoryId: 0,
        hsCode: probe.hsCode,
        weightKg: probe.weightKg,
        volumeCbm: probe.volumeCbm,
        sourcePriceCny: probe.sourcePriceCny,
        moq: probe.moq ?? 50,
        supplierName: "",
        supplierPlatform: "1688",
        leadDays: 7,
        demandScore: 0,
        trend: "stable",
        imageUrl: "",
        description: "",
        certifications: "",
        ipRisk: "low",
      },
      market,
      listing: {
        id: 0,
        productId: 0,
        marketId: market.id,
        platform: q.platform,
        sellPrice: q.sellPrice,
        monthlySales: 0,
        reviewCount: q.reviewCount ?? 0,
        rating: q.rating ?? 0,
        competition: 50,
        bsr: 0,
      },
      shipping,
      tariff,
      fee,
      fx: catalog.fx,
      asOf: opts.asOf,
    });

    const result = calculateProfit(input);
    const cnyLocal = fx.get(market.currency) ?? rate;
    const sellPriceCny = q.sellPrice * cnyLocal;
    const sellUsd = result.sellUsd;

    rows.push({
      marketCode: market.code,
      marketName: market.nameZh,
      flag: market.flag,
      platform: q.platform,
      currency: market.currency,
      sellPriceLocal: q.sellPrice,
      sellPriceCny,
      sourcePriceCny: probe.sourcePriceCny,
      grossSpreadPct:
        ((sellPriceCny - probe.sourcePriceCny) / Math.max(probe.sourcePriceCny, 0.01)) * 100,
      shippingMethod: method,
      shippingLabel: shipping.methodZh,
      dutyRate: input.dutyRate,
      vatRate: input.vatRate,
      result,
      netProfitCny: result.netProfitUsd * rate,
      grade: gradeOf(spreadScore(result)),
      source: q.source,
      url: q.url,
      title: q.title,
      deMinimisUsd: market.deMinimisUsd,
      underDeMinimis: market.deMinimisUsd > 0 && sellUsd < market.deMinimisUsd,
    });
  }

  // 一律按净利排序。毛差价高但净利低的商品排在后面，这是刻意的。
  rows.sort((a, b) => b.result.netProfitUsd - a.result.netProfitUsd);

  return { probe, rows, skipped, best: rows[0] ?? null };
}

/**
 * 按需测算没有需求侧数据（月销、搜索量），所以评级只能基于利润质量。
 * 不拿 opportunityScore 硬套——那个公式里 40% 权重来自需求与竞争，
 * 缺数据时套用会得出一个看似有依据、实际凭空的分数。
 */
export function spreadScore(result: CalcResult): number {
  const margin = Math.min(Math.max(result.marginPct / 40, 0), 1);
  const roi = Math.min(Math.max(result.roiPct / 120, 0), 1);
  const absolute = Math.min(Math.max(result.netProfitUsd / 15, 0), 1);
  return Math.round((0.5 * margin + 0.3 * roi + 0.2 * absolute) * 100);
}
