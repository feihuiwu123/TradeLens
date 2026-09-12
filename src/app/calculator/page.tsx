import { CalculatorForm } from "@/components/calculator-form";
import { SectionTitle } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";
import type { ShippingMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string; market?: string }>;
}) {
  const { sku, market } = await searchParams;
  const catalog = await loadCatalog();
  const marketById = new Map(catalog.markets.map((m) => [m.id, m]));

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="LANDED COST"
        title="全成本利润计算器"
        desc="改一个数字，利润瀑布跟着变。广告和退货是最容易把「看起来很赚」打回原形的两项。"
      />
      <CalculatorForm
        initialSku={sku}
        initialMarket={market}
        products={catalog.products.map((p) => ({
          sku: p.sku,
          nameZh: p.nameZh,
          sourcePriceCny: p.sourcePriceCny,
          weightKg: p.weightKg,
          volumeCbm: p.volumeCbm,
          hsCode: p.hsCode,
          moq: p.moq,
        }))}
        markets={catalog.markets.map((m) => ({
          code: m.code,
          nameZh: m.nameZh,
          flag: m.flag,
          currency: m.currency,
          vatRate: m.vatRate,
        }))}
        listings={catalog.listings.map((l) => ({
          sku: catalog.products.find((p) => p.id === l.productId)?.sku ?? "",
          market: marketById.get(l.marketId)?.code ?? "",
          platform: l.platform,
          sellPrice: l.sellPrice,
        }))}
        shipping={catalog.shipping.map((s) => ({
          market: marketById.get(s.marketId)?.code ?? "",
          method: s.method as ShippingMethod,
          methodZh: s.methodZh,
          ratePerKgUsd: s.ratePerKgUsd,
          ratePerCbmUsd: s.ratePerCbmUsd,
          minChargeUsd: s.minChargeUsd,
        }))}
        tariffs={catalog.tariffs.map((t) => ({
          hsCode: t.hsCode,
          market: marketById.get(t.marketId)?.code ?? "",
          mfnDuty: t.mfnDuty,
          extraDuty: t.extraDuty,
          vatRate: t.vatRate,
        }))}
        fees={catalog.fees.map((f) => ({
          platform: f.platform,
          market: marketById.get(f.marketId)?.code ?? "",
          referralRate: f.referralRate,
          fulfillmentPerUnitUsd: f.fulfillmentPerUnitUsd,
          paymentFeeRate: f.paymentFeeRate,
        }))}
        fx={catalog.fx.map((f) => ({ currency: f.currency, cnyPerUnit: f.cnyPerUnit }))}
      />
    </main>
  );
}
