import { z } from "zod";
import { loadCatalog } from "@/lib/catalog";
import { AMAZON_HOSTS, discoverSpread, type MarketQuote } from "@/lib/spread";
import { badRequest, marketCodeSchema, parseJson, route, shippingMethodSchema } from "@/server/http";
import { priceStats, resolveMarketListings, type PriceStats, type RealListing } from "@/server/providers/amazon-search";
import { ScrapeRejected, createFirecrawlProvider } from "@/server/providers/firecrawl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 按需价差发现（方式2 被动响应式）。
 *
 * 两种输入：
 * - quotes：用户自己贴好的各国售价，零外部调用，最快且最准（商品配对由人确认）
 * - markets + asin：按站点抓取，自动化但受扇出预算限制
 *
 * 扇出闸门：方式2 虽然省存储，但没省掉扇出。一次「子类目 × 12 国」
 * 就是 12+ 次抓取，不设上限一样会把配额烧光。
 */
const MAX_FANOUT = 6;

const probeSchema = z.object({
  nameZh: z.string().trim().min(1).max(120),
  sourcePriceCny: z.number().positive().max(1_000_000),
  weightKg: z.number().positive().max(1000),
  volumeCbm: z.number().nonnegative().max(100),
  hsCode: z.string().trim().regex(/^\d{4}(\.\d{2})?$/, "HS 编码应为 4 位或 6 位，如 8518.30"),
  moq: z.number().int().positive().max(100_000).optional(),
});

const bodySchema = z
  .object({
    probe: probeSchema,
    method: shippingMethodSchema.or(z.literal("auto")).default("auto"),
    /** 手工提供的各国售价 */
    quotes: z
      .array(
        z.object({
          market: marketCodeSchema,
          platform: z.string().trim().min(1).max(40).default("Amazon"),
          sellPrice: z.number().positive(),
          url: z.string().url().optional(),
        }),
      )
      .max(20)
      .optional(),
    /** 需要自动抓取的市场 */
    markets: z.array(marketCodeSchema).max(MAX_FANOUT).optional(),
    /** 各站点的商品编号。ASIN 分站点，所以按市场分别给。 */
    asinByMarket: z.record(z.string(), z.string().trim().min(5).max(20)).optional(),
    /**
     * 关键词自动解析真实在售商品。
     * 给了这个就不需要 asinByMarket——每个市场抓一次搜索页，取真实商品与价格。
     */
    keyword: z.string().trim().min(1).max(80).optional(),
    /** 每个市场取多少个真实商品作为价格样本 */
    sampleSize: z.number().int().min(3).max(20).default(10),
  })
  .refine(
    (v) => (v.quotes?.length ?? 0) > 0 || (v.markets?.length ?? 0) > 0,
    { message: "至少提供 quotes（手工售价）或 markets（自动抓取）之一" },
  );

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { probe, quotes, markets, asinByMarket, method, keyword, sampleSize } = parsed.data;

  const catalog = await loadCatalog();
  const collected: MarketQuote[] = [];
  const failures: { marketCode: string; reason: string }[] = [];

  // 1) 手工售价：零外部调用，优先采用
  for (const q of quotes ?? []) {
    collected.push({
      marketCode: q.market,
      platform: q.platform,
      sellPrice: q.sellPrice,
      source: "手工录入",
      url: q.url,
    });
  }

  // 2a) 关键词自动解析真实在售商品：每个市场抓一次搜索页
  const resolvedByMarket: Record<string, RealListing[]> = {};
  const statsByMarket: Record<string, PriceStats> = {};
  if (markets?.length && keyword) {
    const results = await Promise.allSettled(
      markets.map(async (m) => ({ market: m, r: await resolveMarketListings(m, keyword, sampleSize) })),
    );
    for (const [i, res] of results.entries()) {
      const m = markets[i];
      if (res.status !== "fulfilled") {
        const e = res.reason;
        failures.push({
          marketCode: m,
          reason: e instanceof ScrapeRejected ? e.reason : e instanceof Error ? e.message : "解析失败",
        });
        continue;
      }
      const listings = res.value.r.value;
      const stats = priceStats(listings);
      if (!stats) {
        failures.push({ marketCode: m, reason: "未解析出有效价格" });
        continue;
      }
      const median = stats.median;
      resolvedByMarket[m] = listings;
      statsByMarket[m] = stats;
      // 取中位数作为该市场的代表价：搜索结果里混着配件与高端品，均值会被离群值拉偏。
      // 注意这不是「同一个商品的跨国比价」——各站搜索结果本就是不同商品，
      // 这里比的是该品类在各市场的价格水位。
      const representative = listings.reduce((best, l) =>
        Math.abs(l.price - median) < Math.abs(best.price - median) ? l : best,
      );
      collected.push({
        marketCode: m,
        platform: "Amazon",
        sellPrice: median,
        title: representative.title,
        rating: representative.rating,
        reviewCount: representative.reviewCount,
        source: `${res.value.r.source} · ${listings.length} 个样本取中位数`,
        url: representative.url,
      });
    }
  }

  // 2b) 指定 ASIN 精确抓取
  if (markets?.length && !keyword) {
    if (!asinByMarket || Object.keys(asinByMarket).length === 0) {
      return badRequest(
        "自动抓取需要提供 keyword（关键词解析真实商品）或 asinByMarket——ASIN 是分站点的，不能用一个 ASIN 查所有国家",
      );
    }

    const fc = createFirecrawlProvider();
    const targets = markets.filter((m) => asinByMarket[m] && AMAZON_HOSTS[m]);
    for (const m of markets) {
      if (!AMAZON_HOSTS[m]) failures.push({ marketCode: m, reason: "该市场暂未配置 Amazon 站点域名" });
      else if (!asinByMarket[m]) failures.push({ marketCode: m, reason: "未提供该站点的 ASIN" });
    }

    const results = await Promise.allSettled(
      targets.map(async (m) => {
        const url = `https://www.${AMAZON_HOSTS[m]}/dp/${asinByMarket[m]}`;
        const r = await fc.scrapeListing(url);
        return { market: m, url, listing: r.value, source: r.source };
      }),
    );

    for (const [i, r] of results.entries()) {
      const m = targets[i];
      if (r.status === "fulfilled") {
        collected.push({
          marketCode: m,
          platform: "Amazon",
          sellPrice: r.value.listing.price,
          currency: r.value.listing.currency ?? undefined,
          title: r.value.listing.title,
          rating: r.value.listing.rating,
          reviewCount: r.value.listing.reviewCount,
          source: r.value.source,
          url: r.value.url,
        });
      } else {
        const e = r.reason;
        failures.push({
          marketCode: m,
          reason: e instanceof ScrapeRejected ? e.reason : e instanceof Error ? e.message : "抓取失败",
        });
      }
    }
  }

  const report = discoverSpread(catalog, probe, collected, { methodPref: method });

  return Response.json({
    probe: report.probe,
    count: report.rows.length,
    best: report.best
      ? { market: report.best.marketCode, netProfitCny: report.best.netProfitCny, grade: report.best.grade.grade }
      : null,
    rows: report.rows.map((r) => ({
      market: r.marketCode,
      marketName: r.marketName,
      platform: r.platform,
      sellPriceLocal: r.sellPriceLocal,
      currency: r.currency,
      sellPriceCny: +r.sellPriceCny.toFixed(2),
      grossSpreadPct: +r.grossSpreadPct.toFixed(1),
      netProfitCny: +r.netProfitCny.toFixed(2),
      marginPct: +r.result.marginPct.toFixed(1),
      roiPct: +r.result.roiPct.toFixed(1),
      dutyPct: +(r.dutyRate * 100).toFixed(1),
      vatPct: +(r.vatRate * 100).toFixed(1),
      shipping: r.shippingLabel,
      verdict: r.result.verdict,
      grade: r.grade.grade,
      underDeMinimis: r.underDeMinimis,
      deMinimisUsd: r.deMinimisUsd,
      source: r.source,
      title: r.title,
      url: r.url,
      /** 该市场的真实在售商品样本，每条都带可点击的商品页链接 */
      listings: (resolvedByMarket[r.marketCode] ?? []).map((l) => ({
        asin: l.asin,
        title: l.title,
        price: l.price,
        rating: l.rating,
        reviewCount: l.reviewCount,
        url: l.url,
      })),
      /** 样本价格分布。mixed=true 表示样本横跨白牌与品牌，中位数不足以代表可达售价 */
      priceStats: statsByMarket[r.marketCode]
        ? {
            min: statsByMarket[r.marketCode].min,
            max: statsByMarket[r.marketCode].max,
            spread: +statsByMarket[r.marketCode].spread.toFixed(1),
            mixed: statsByMarket[r.marketCode].mixed,
          }
        : null,
    })),
    /**
     * 跨市场可比性警告。
     * 各站搜索结果是不同商品，若某市场中位数远高于其它市场，通常是该站搜出了品牌货，
     * 而非真的存在套利空间——拿白牌成本对标品牌售价会得出完全错误的结论。
     */
    comparabilityWarning: (() => {
      const notes: string[] = [];

      // (1) 市场内跨度过大：单一中位数不足以代表可达售价
      const mixed = Object.entries(statsByMarket).filter(([, s]) => s.mixed).map(([m]) => m);
      if (mixed.length > 0) {
        notes.push(`${mixed.join("、")} 的样本内部价格跨度超过 4 倍，同时混有白牌与品牌商品。`);
      }

      // (2) 跨市场价格水位背离：折成人民币后比较。
      // 同一关键词在两站的价格水位差几倍，几乎必然是搜出了不同档位的商品，
      // 而不是真的存在套利空间——拿白牌成本对标品牌售价会得出完全错误的结论。
      const normalized = report.rows
        .filter((r) => statsByMarket[r.marketCode])
        .map((r) => ({ market: r.marketName, cny: r.sellPriceCny }));
      if (normalized.length >= 2) {
        const hi = normalized.reduce((a, b) => (b.cny > a.cny ? b : a));
        const lo = normalized.reduce((a, b) => (b.cny < a.cny ? b : a));
        const ratio = lo.cny > 0 ? hi.cny / lo.cny : Infinity;
        if (ratio >= 2) {
          notes.push(
            `${hi.market}（¥${hi.cny.toFixed(0)}）的价格水位是 ${lo.market}（¥${lo.cny.toFixed(0)}）的 ${ratio.toFixed(1)} 倍，` +
              `两站搜出的多半不是同档位商品。`,
          );
        }
      }

      if (notes.length === 0) return null;
      return `${notes.join("")}中位数不代表你的货能卖到的价格，请点开下方真实商品，挑与你货源同档位的逐个对标。`;
    })(),
    // 失败的市场必须回报，不能静默丢弃——用户需要知道哪几个国家没算上
    skipped: [...report.skipped, ...failures],
  });
});
