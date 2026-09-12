import { loadCatalog } from "@/lib/catalog";
import { freightPerUnitUsd } from "@/lib/profit";
import type { ShippingMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketCode = (url.searchParams.get("market") ?? "US").toUpperCase();
  const weightKg = Number(url.searchParams.get("weightKg") ?? 0.3);
  const volumeCbm = Number(url.searchParams.get("volumeCbm") ?? 0.001);
  const quantity = Number(url.searchParams.get("quantity") ?? 50);
  const catalog = await loadCatalog();
  const market = catalog.markets.find((m) => m.code === marketCode);
  if (!market) return Response.json({ error: "unknown market" }, { status: 404 });
  const rates = catalog.shipping.filter((s) => s.marketId === market.id);
  return Response.json({
    market: market.code,
    items: rates.map((s) => {
      const per = freightPerUnitUsd({
        quantity,
        weightKg,
        volumeCbm,
        shippingMethod: s.method as ShippingMethod,
        ratePerKgUsd: s.ratePerKgUsd,
        ratePerCbmUsd: s.ratePerCbmUsd,
        minChargeUsd: s.minChargeUsd,
      });
      return {
        method: s.method,
        methodZh: s.methodZh,
        perUnitUsd: per,
        orderUsd: per * Math.max(1, quantity),
        daysMin: s.daysMin,
        daysMax: s.daysMax,
        notes: s.notes,
      };
    }),
  });
}
