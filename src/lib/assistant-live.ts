import type { Product } from "@/db/schema";
import { money, pct } from "@/lib/format";
import { calculateProfit } from "@/lib/profit";
import type { Opportunity } from "@/lib/types";
import { buildCalcInput, findFee, findShipping, findTariff } from "@/lib/catalog";
import { priceStats, resolveMarketListings } from "@/server/providers/amazon-search";
import { ScrapeRejected } from "@/server/providers/firecrawl";
import type { Catalog } from "@/server/store/types";

/**
 * 助手的实盘对比层。
 *
 * 为什么单独一层而不是塞进 answerAssistant：
 * 抓一个市场冷启动要 5~7 秒，不能每句话都抓。只有当助手确定用户在问某个
 * 具体商品时才触发，且市场数有上限——否则问一句「耳机怎么样」要等一分钟。
 */

/** 一次对话最多实盘核验几个市场 */
const MAX_LIVE_MARKETS = 3;

/** 快照只来自 Amazon 搜索页，其它平台的基准价不能用它对比 */
const AMAZON = /amazon/i;

export type LiveComparison = {
  marketCode: string;
  marketName: string;
  currency: string;
  baseline: number;
  actual: number;
  deviationPct: number;
  baselineMarginPct: number;
  actualMarginPct: number;
  verdictFlipped: boolean;
  mixed: boolean;
  sampleCount: number;
  topUrl: string | null;
  topTitle: string | null;
  cached: boolean;
};

function recalc(catalog: Catalog, o: Opportunity, sellPriceLocal: number) {
  const product = catalog.products.find((p) => p.id === o.productId);
  const market = catalog.markets.find((m) => m.id === o.marketId);
  const listing = catalog.listings.find(
    (l) => l.productId === o.productId && l.marketId === o.marketId && l.platform === o.platform,
  );
  const shipping = findShipping(catalog.shipping, o.marketId, o.shippingMethod);
  if (!product || !market || !listing || !shipping) return null;

  return calculateProfit(
    buildCalcInput({
      product,
      market,
      listing: { ...listing, sellPrice: sellPriceLocal },
      shipping,
      tariff: findTariff(catalog.tariffs, product.hsCode, market.id),
      fee: findFee(catalog.fees, o.platform, market.id),
      fx: catalog.fx,
    }),
  );
}

/**
 * 对某个商品的若干市场做实盘核验。
 *
 * 按基准净利从高到低取前 N 个 Amazon 市场——用户最可能照着最高的那条下单，
 * 也就最需要知道它是不是被高估了。
 */
export async function compareLive(
  catalog: Catalog,
  product: Product,
  opps: Opportunity[],
): Promise<{ rows: LiveComparison[]; skipped: { market: string; reason: string }[] }> {
  const keyword = product.nameEn || product.nameZh;
  const targets = opps
    .filter((o) => AMAZON.test(o.platform))
    .sort((a, b) => b.result.netProfitUsd - a.result.netProfitUsd)
    .slice(0, MAX_LIVE_MARKETS);

  const rows: LiveComparison[] = [];
  const skipped: { market: string; reason: string }[] = [];

  const settled = await Promise.allSettled(
    targets.map(async (o) => ({ o, r: await resolveMarketListings(o.marketCode, keyword, 10) })),
  );

  for (const [i, res] of settled.entries()) {
    const o = targets[i];
    if (res.status !== "fulfilled") {
      const e = res.reason;
      skipped.push({
        market: o.marketName,
        reason: e instanceof ScrapeRejected ? e.reason : e instanceof Error ? e.message : "抓取失败",
      });
      continue;
    }
    const stats = priceStats(res.value.r.value);
    if (!stats) {
      skipped.push({ market: o.marketName, reason: "未解析出有效价格" });
      continue;
    }
    const recalced = recalc(catalog, o, stats.median);
    if (!recalced) {
      skipped.push({ market: o.marketName, reason: "缺少重算所需参数" });
      continue;
    }
    const top = res.value.r.value.reduce((best, l) =>
      Math.abs(l.price - stats.median) < Math.abs(best.price - stats.median) ? l : best,
    );

    rows.push({
      marketCode: o.marketCode,
      marketName: o.marketName,
      currency: o.currency,
      baseline: o.sellPriceLocal,
      actual: +stats.median.toFixed(2),
      deviationPct: +(((stats.median - o.sellPriceLocal) / o.sellPriceLocal) * 100).toFixed(1),
      baselineMarginPct: +o.result.marginPct.toFixed(1),
      actualMarginPct: +recalced.marginPct.toFixed(1),
      verdictFlipped: o.result.verdict === "go" && recalced.verdict !== "go",
      mixed: stats.mixed,
      sampleCount: stats.count,
      topUrl: top?.url ?? null,
      topTitle: top?.title ?? null,
      cached: res.value.r.source.startsWith("快照缓存"),
    });
  }

  // 按实测净利率排序：告诉用户核验后哪个市场真正最好，而不是基准值说哪个最好
  rows.sort((a, b) => b.actualMarginPct - a.actualMarginPct);
  return { rows, skipped };
}

/** 把实盘核验结果渲染成助手回答里的一段文本 */
export function formatLiveComparison(
  result: { rows: LiveComparison[]; skipped: { market: string; reason: string }[] },
  productName: string,
): string {
  const { rows, skipped } = result;
  if (rows.length === 0) {
    const why = skipped.map((s) => `${s.market}（${s.reason}）`).join("、");
    return `\n\n【实盘核验】未能取到${productName}的在售价：${why || "无可核验的 Amazon 市场"}。以上数字仍是模型基准值。`;
  }

  const lines = rows.map((r) => {
    const dir = r.deviationPct < 0 ? "低" : "高";
    const flag = r.verdictFlipped ? "  ⚠ 基准判可做，实测只是薄利" : "";
    const mixed = r.mixed ? "（样本混有品牌货，仅供参考）" : "";
    return (
      `· ${r.marketName}：基准 ${r.currency} ${r.baseline} → 实测 ${r.currency} ${r.actual}` +
      `（实际${dir} ${Math.abs(r.deviationPct)}%，${r.sampleCount} 件样本${r.cached ? "·快照" : "·刚抓"}）\n` +
      `  净利率 ${pct(r.baselineMarginPct)} → ${pct(r.actualMarginPct)}${flag}${mixed}\n` +
      (r.topUrl ? `  参考商品：${r.topTitle?.slice(0, 50)} ${r.topUrl}` : "")
    );
  });

  const flips = rows.filter((r) => r.verdictFlipped).length;
  const verdict =
    flips > 0
      ? `\n\n结论：有 ${flips} 个市场的判定被实测推翻——基准值显示可做，按真实在售价重算只是薄利。不要照基准值备货。`
      : `\n\n结论：实测价与基准值方向一致，最优市场是 ${rows[0].marketName}（实测净利率 ${pct(rows[0].actualMarginPct)}）。`;

  const skippedNote =
    skipped.length > 0 ? `\n未能核验：${skipped.map((s) => `${s.market}（${s.reason}）`).join("、")}` : "";

  return `\n\n【实盘核验】上面是模型基准值，下面是刚从各站抓到的真实在售价：\n\n${lines.join("\n\n")}${skippedNote}${verdict}`;
}

export { MAX_LIVE_MARKETS };
