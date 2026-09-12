import { buildOpportunities, loadCatalog } from "@/lib/catalog";
import type { ShippingMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = url.searchParams.get("market");
  const category = url.searchParams.get("category");
  const minMargin = Number(url.searchParams.get("minMargin") ?? 0);
  const method = (url.searchParams.get("method") ?? "auto") as ShippingMethod | "auto";
  const catalog = await loadCatalog();
  let items = buildOpportunities(catalog, method);
  if (market) items = items.filter((o) => o.marketCode === market.toUpperCase());
  if (category) items = items.filter((o) => o.categorySlug === category);
  if (minMargin) items = items.filter((o) => o.result.marginPct >= minMargin);
  return Response.json({
    count: items.length,
    items: items.map((o) => ({
      sku: o.sku,
      nameZh: o.nameZh,
      market: o.marketCode,
      platform: o.platform,
      sourcePriceCny: o.sourcePriceCny,
      sellPrice: o.sellPriceLocal,
      currency: o.currency,
      netProfitUsd: o.result.netProfitUsd,
      marginPct: o.result.marginPct,
      roiPct: o.result.roiPct,
      verdict: o.result.verdict,
      score: o.score,
      shipping: o.shippingMethod,
      days: `${o.daysMin}-${o.daysMax}`,
      monthlySales: o.monthlySales,
      hsCode: o.hsCode,
    })),
  });
}
