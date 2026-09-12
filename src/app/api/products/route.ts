import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const category = url.searchParams.get("category");
  const catalog = await loadCatalog();
  const items = catalog.products.filter((p) => {
    const cat = catalog.categories.find((c) => c.id === p.categoryId);
    if (category && cat?.slug !== category) return false;
    if (!q) return true;
    return `${p.nameZh} ${p.nameEn} ${p.sku} ${p.hsCode}`.toLowerCase().includes(q);
  });
  return Response.json({
    items: items.map((p) => {
      const cat = catalog.categories.find((c) => c.id === p.categoryId);
      return {
        id: p.id,
        sku: p.sku,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        category: cat?.slug,
        hsCode: p.hsCode,
        sourcePriceCny: p.sourcePriceCny,
        weightKg: p.weightKg,
        volumeCbm: p.volumeCbm,
        moq: p.moq,
        demandScore: p.demandScore,
        trend: p.trend,
        ipRisk: p.ipRisk,
      };
    }),
  });
}
