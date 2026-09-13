import { z } from "zod";
import { loadCatalog } from "@/lib/catalog";
import { notFound, parseQuery, route } from "@/server/http";
import { priceStats, resolveMarketListings } from "@/server/providers/amazon-search";
import { ScrapeRejected } from "@/server/providers/firecrawl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 为榜单里某条机会拉取该市场的实时在售价与真实商品链接。
 *
 * 榜单本身仍展示模型基准值（覆盖 61 条组合，全部实时抓会把配额烧光且要等几分钟）。
 * 用户点某一条时才按需拉取，命中快照则秒回。
 */
const querySchema = z.object({
  market: z.string().trim().length(2).toUpperCase(),
  keyword: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(3).max(20).default(8),
});

export const GET = route(async (request: Request) => {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { market, keyword, limit } = parsed.data;

  const catalog = await loadCatalog();
  const m = catalog.markets.find((x) => x.code === market);
  if (!m) return notFound(`未收录市场 ${market}`);

  try {
    const r = await resolveMarketListings(market, keyword, limit);
    const stats = priceStats(r.value);
    return Response.json({
      market,
      marketName: m.nameZh,
      currency: m.currency,
      keyword,
      source: r.source,
      fetchedAt: r.fetchedAt.toISOString(),
      /** true 表示读自快照而非刚抓的 */
      cached: r.source.startsWith("快照缓存"),
      median: stats?.median ?? null,
      range: stats ? { min: stats.min, max: stats.max } : null,
      mixed: stats?.mixed ?? false,
      listings: r.value,
    });
  } catch (error) {
    // 抓取失败是常态（限流、拦截），如实回报而不是 500
    return Response.json(
      {
        market,
        error: error instanceof ScrapeRejected ? error.reason : error instanceof Error ? error.message : "抓取失败",
        listings: [],
      },
      { status: 200 },
    );
  }
});
