import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json({
    items: catalog.markets.map((m) => ({
      code: m.code,
      nameZh: m.nameZh,
      nameEn: m.nameEn,
      currency: m.currency,
      vatRate: m.vatRate,
      deMinimisUsd: m.deMinimisUsd,
      demandIndex: m.demandIndex,
      competitionIndex: m.competitionIndex,
      logisticsScore: m.logisticsScore,
      notes: m.notes,
    })),
  });
}
