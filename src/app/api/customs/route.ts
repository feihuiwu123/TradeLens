import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hs = url.searchParams.get("hs");
  const market = url.searchParams.get("market");
  const catalog = await loadCatalog();
  const marketById = new Map(catalog.markets.map((m) => [m.id, m]));
  let rows = catalog.tariffs;
  if (hs) rows = rows.filter((t) => t.hsCode === hs);
  if (market) {
    const m = catalog.markets.find((x) => x.code === market.toUpperCase());
    if (m) rows = rows.filter((t) => t.marketId === m.id);
  }
  return Response.json({
    items: rows.map((t) => {
      const m = marketById.get(t.marketId);
      return {
        hsCode: t.hsCode,
        market: m?.code,
        mfnDuty: t.mfnDuty,
        extraDuty: t.extraDuty,
        totalDuty: t.mfnDuty + t.extraDuty,
        vatRate: t.vatRate,
        deMinimisUsd: m?.deMinimisUsd,
        notes: t.notes,
      };
    }),
  });
}
