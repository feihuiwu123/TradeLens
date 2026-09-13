import { z } from "zod";
import { buildCalcInput, buildOpportunities, cnyPerUsd, findFee, findShipping, findTariff, loadCatalog } from "@/lib/catalog";
import { calculateProfit } from "@/lib/profit";
import type { Opportunity } from "@/lib/types";
import { parseQuery, route } from "@/server/http";
import { priceStats, resolveMarketListings } from "@/server/providers/amazon-search";
import { ScrapeRejected } from "@/server/providers/firecrawl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 用实测在售价校准榜单的模型基准值。
 *
 * 起因：给德国站吹风机拉实时价时发现实际中位价比基准值低 23%，
 * 说明种子里的售价（以及由它算出的净利率）系统性失真。这个接口把这件事量化：
 * 逐条对比基准价与实测中位价，并按实测价重算净利，给出真实影响。
 *
 * 扇出控制：每条冷抓要 5~7 秒，所以默认只跑净利最高的前 N 条，
 * 并发 3 路；命中快照的直接秒回。
 */
const CONCURRENCY = 3;

const querySchema = z.object({
  /** 校准前多少条（按净利排序） */
  limit: z.coerce.number().int().min(1).max(20).default(8),
  /** 只校准指定市场，留空则不限 */
  market: z.string().trim().length(2).toUpperCase().optional(),
});

/**
 * 按实测价重建测算入参。
 *
 * 不把 CalcInput 挂到 Opportunity 上，是因为榜单要把 61 条组合序列化给客户端，
 * 每条多带二十几个字段是实打实的传输开销，而重算只在校准时才需要。
 */
function recalcWith(
  catalog: Awaited<ReturnType<typeof loadCatalog>>,
  o: Opportunity,
  sellPriceLocal: number,
) {
  const product = catalog.products.find((p) => p.id === o.productId);
  const market = catalog.markets.find((m) => m.id === o.marketId);
  const listing = catalog.listings.find(
    (l) => l.productId === o.productId && l.marketId === o.marketId && l.platform === o.platform,
  );
  const shipping = findShipping(catalog.shipping, o.marketId, o.shippingMethod);
  if (!product || !market || !listing || !shipping) return null;

  const input = buildCalcInput({
    product,
    market,
    listing: { ...listing, sellPrice: sellPriceLocal },
    shipping,
    tariff: findTariff(catalog.tariffs, product.hsCode, market.id),
    fee: findFee(catalog.fees, o.platform, market.id),
    fx: catalog.fx,
  });
  return calculateProfit(input);
}

/** 简单并发闸门：避免一次性打爆外部站点触发限流 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export const GET = route(async (request: Request) => {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, market } = parsed.data;

  const catalog = await loadCatalog();
  const rate = cnyPerUsd(catalog.fx);
  const all = buildOpportunities(catalog);
  const targets = all
    .filter((o) => (market ? o.marketCode === market : true))
    .filter((o) => o.nameEn || o.nameZh)
    .slice(0, limit);

  const rows = await mapLimit(targets, CONCURRENCY, async (o) => {
    const keyword = o.nameEn || o.nameZh;
    try {
      const r = await resolveMarketListings(o.marketCode, keyword, 10);
      const stats = priceStats(r.value);
      if (!stats) throw new ScrapeRejected("未解析出有效价格");

      // 按实测中位价重算全成本利润，得出基准值失真造成的真实影响
      const recalced = recalcWith(catalog, o, stats.median);
      if (!recalced) throw new ScrapeRejected("缺少重算所需的市场或运价参数");
      const deviationPct = ((stats.median - o.sellPriceLocal) / o.sellPriceLocal) * 100;

      return {
        sku: o.sku,
        nameZh: o.nameZh,
        market: o.marketCode,
        marketName: o.marketName,
        currency: o.currency,
        baselineLocal: o.sellPriceLocal,
        actualLocal: +stats.median.toFixed(2),
        deviationPct: +deviationPct.toFixed(1),
        range: { min: stats.min, max: stats.max },
        mixed: stats.mixed,
        sampleCount: stats.count,
        baselineMarginPct: +o.result.marginPct.toFixed(1),
        actualMarginPct: +recalced.marginPct.toFixed(1),
        marginDeltaPct: +(recalced.marginPct - o.result.marginPct).toFixed(1),
        baselineNetCny: +(o.result.netProfitUsd * rate).toFixed(2),
        actualNetCny: +(recalced.netProfitUsd * rate).toFixed(2),
        /** 基准值判定可做、实测判定不可做——最危险的一类 */
        verdictFlipped: o.result.verdict === "go" && recalced.verdict !== "go",
        baselineVerdict: o.result.verdict,
        actualVerdict: recalced.verdict,
        cached: r.source.startsWith("快照缓存"),
        source: r.source,
        topListings: r.value.slice(0, 3).map((l) => ({ title: l.title, price: l.price, url: l.url })),
        error: null as string | null,
      };
    } catch (error) {
      return {
        sku: o.sku,
        nameZh: o.nameZh,
        market: o.marketCode,
        marketName: o.marketName,
        currency: o.currency,
        baselineLocal: o.sellPriceLocal,
        error: error instanceof ScrapeRejected ? error.reason : error instanceof Error ? error.message : "抓取失败",
      };
    }
  });

  const ok = rows.filter((r) => !r.error && "deviationPct" in r) as Extract<
    (typeof rows)[number],
    { deviationPct: number }
  >[];

  return Response.json({
    checked: rows.length,
    succeeded: ok.length,
    summary:
      ok.length > 0
        ? {
            /** 用绝对值平均衡量基准值整体偏离程度 */
            avgAbsDeviationPct: +(ok.reduce((s, r) => s + Math.abs(r.deviationPct), 0) / ok.length).toFixed(1),
            overstated: ok.filter((r) => r.deviationPct < -5).length,
            understated: ok.filter((r) => r.deviationPct > 5).length,
            withinFivePct: ok.filter((r) => Math.abs(r.deviationPct) <= 5).length,
            verdictFlips: ok.filter((r) => r.verdictFlipped).length,
          }
        : null,
    rows,
  });
});
