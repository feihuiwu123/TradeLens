import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Verdict, Waterfall } from "@/components/ui";
import { WatchButton } from "@/components/watch-button";
import { buildOpportunities, getWatchlistItems, loadCatalog } from "@/lib/catalog";
import { money, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { id } = await params;
  const { market } = await searchParams;
  const catalog = await loadCatalog();
  const product = catalog.products.find((p) => p.id === Number(id));
  if (!product) notFound();
  const category = catalog.categories.find((c) => c.id === product.categoryId);
  const opps = buildOpportunities(catalog).filter((o) => o.productId === product.id);
  const selected = opps.find((o) => o.marketCode === market) ?? opps[0];
  const watched = selected
    ? (await getWatchlistItems()).some((w) => w.productId === product.id && w.marketId === selected.marketId)
    : false;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel overflow-hidden rounded-[2rem]">
          <img src={product.imageUrl} alt={product.nameZh} className="h-80 w-full object-cover" />
          <div className="space-y-4 p-7">
            <div className="flex flex-wrap gap-2">
              <Badge>{category?.nameZh}</Badge>
              <Badge tone="teal">{product.supplierPlatform}</Badge>
              <Badge tone={product.trend === "rising" ? "ok" : product.trend === "falling" ? "no" : "mute"}>
                {product.trend === "rising" ? "需求上升" : product.trend === "falling" ? "需求回落" : "需求平稳"}
              </Badge>
            </div>
            <h1 className="font-serif text-4xl">{product.nameZh}</h1>
            <p className="text-[var(--muted)]">{product.description}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Info k="货源价" v={`¥${product.sourcePriceCny.toFixed(2)}`} />
              <Info k="MOQ" v={String(product.moq)} />
              <Info k="重量" v={`${product.weightKg} kg`} />
              <Info k="体积" v={`${product.volumeCbm} cbm`} />
              <Info k="HS" v={product.hsCode} />
              <Info k="交期" v={`${product.leadDays} 天`} />
              <Info k="认证" v={product.certifications} />
              <Info k="IP 风险" v={product.ipRisk} />
            </dl>
            <p className="text-sm text-[var(--muted)]">供应商 {product.supplierName} · SKU {product.sku}</p>
          </div>
        </div>

        {selected ? (
          <div className="panel rounded-[2rem] p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--gold)]">FULL LANDED COST</p>
                <h2 className="font-serif mt-2 text-3xl">
                  {selected.flag} {selected.marketName} · {selected.platform}
                </h2>
              </div>
              <Verdict verdict={selected.result.verdict} />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{selected.result.verdictLabel}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Info k="净利润" v={money(selected.result.netProfitUsd)} />
              <Info k="利润率" v={pct(selected.result.marginPct)} />
              <Info k="ROI" v={pct(selected.result.roiPct)} />
            </div>
            <div className="mt-6">
              <Waterfall
                lines={selected.result.lines}
                landed={selected.result.landedUsd}
                sell={selected.result.sellUsd}
                net={selected.result.netProfitUsd}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <WatchButton productId={product.id} marketId={selected.marketId} watched={watched} />
              <Link
                href={`/calculator?sku=${product.sku}&market=${selected.marketCode}`}
                className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm"
              >
                在计算器中打开
              </Link>
            </div>
          </div>
        ) : (
          <p>暂无市场报价。</p>
        )}
      </div>

      <h2 className="font-serif mt-12 mb-5 text-3xl">同一货源，不同国家</h2>
      <div className="overflow-x-auto panel rounded-3xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="p-4">市场</th>
              <th>平台</th>
              <th>售价</th>
              <th>月销</th>
              <th>物流</th>
              <th>净利</th>
              <th>利润率</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => (
              <tr key={`${o.marketCode}-${o.platform}`} className="border-t border-white/5">
                <td className="p-4">
                  <Link href={`/products/${product.id}?market=${o.marketCode}`}>
                    {o.flag} {o.marketName}
                  </Link>
                </td>
                <td>{o.platform}</td>
                <td className="num">{o.currency} {o.sellPriceLocal}</td>
                <td className="num">{o.monthlySales}</td>
                <td>{o.shippingLabel}</td>
                <td className="num">{money(o.result.netProfitUsd)}</td>
                <td className="num">{pct(o.result.marginPct)}</td>
                <td className="py-3">
                  <Verdict verdict={o.result.verdict} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <dt className="text-xs text-[var(--muted)]">{k}</dt>
      <dd className="mt-1">{v}</dd>
    </div>
  );
}
