import { ShippingBoard } from "@/components/shipping-board";
import { SectionTitle } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";
import type { ShippingMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const catalog = await loadCatalog();
  const marketById = new Map(catalog.markets.map((m) => [m.id, m]));

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="FREIGHT"
        title="头程运费对照"
        desc="测款用快递，确认复购后空运，稳定 SKU 再海运进仓。体积大的收纳和瑜伽垫，快递路径上差价会被运费吃光。"
      />
      <ShippingBoard
        markets={catalog.markets.map((m) => ({ code: m.code, nameZh: m.nameZh, flag: m.flag }))}
        rates={catalog.shipping.map((s) => ({
          market: marketById.get(s.marketId)?.code ?? "",
          method: s.method as ShippingMethod,
          methodZh: s.methodZh,
          ratePerKgUsd: s.ratePerKgUsd,
          ratePerCbmUsd: s.ratePerCbmUsd,
          minChargeUsd: s.minChargeUsd,
          daysMin: s.daysMin,
          daysMax: s.daysMax,
          notes: s.notes,
        }))}
      />
    </main>
  );
}
