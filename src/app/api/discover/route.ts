import { z } from "zod";
import { loadCatalog } from "@/lib/catalog";
import { AMAZON_HOSTS, discoverSpread, type MarketQuote } from "@/lib/spread";
import { badRequest, marketCodeSchema, parseJson, route, shippingMethodSchema } from "@/server/http";
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
  })
  .refine((v) => (v.quotes?.length ?? 0) > 0 || (v.markets?.length ?? 0) > 0, {
    message: "至少提供 quotes（手工售价）或 markets（自动抓取）之一",
  });

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { probe, quotes, markets, asinByMarket, method } = parsed.data;

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

  // 2) 自动抓取
  if (markets?.length) {
    if (!asinByMarket || Object.keys(asinByMarket).length === 0) {
      return badRequest("自动抓取需要提供 asinByMarket——ASIN 是分站点的，不能用一个 ASIN 查所有国家");
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
    })),
    // 失败的市场必须回报，不能静默丢弃——用户需要知道哪几个国家没算上
    skipped: [...report.skipped, ...failures],
  });
});
