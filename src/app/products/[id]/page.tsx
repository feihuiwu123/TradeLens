import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PlatformLinks } from "@/components/platform-links";
import { Verdict, Waterfall } from "@/components/ui";
import { WatchButton } from "@/components/watch-button";
import { buildOpportunities, cnyPerUsd, getWatchlistItems, loadCatalog } from "@/lib/catalog";
import { money, pct } from "@/lib/format";
import { sellingLinks, sourcingLinks } from "@/lib/marketplace-urls";
import type { Opportunity } from "@/lib/types";
import { LISTING_TTL_MS, medianPrice } from "@/server/providers/amazon-search";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

type PriceSource = {
  /** 实测中位价（当地币种），无快照时为 null */
  actual: number | null;
  /** 与基准值的偏离百分比 */
  deviationPct: number | null;
  /** 最接近中位数的那个真实商品，价格与链接严格对应 */
  representative: { title: string; price: number; url: string } | null;
  sampleCount: number;
  fetchedAt: Date | null;
};

/**
 * 读取已缓存的实测价作为「价格来源」。
 *
 * 只读快照、不触发抓取——详情页一打开就对每个市场发起抓取会又慢又烧配额。
 * 没有快照时返回空，UI 退回展示平台搜索链接供用户自行核价，
 * 而不是拿一个搜索链接冒充「这就是该价格的出处」。
 */
async function loadPriceSources(opps: Opportunity[]): Promise<Map<string, PriceSource>> {
  const store = getStore();
  const out = new Map<string, PriceSource>();

  await Promise.all(
    opps.map(async (o) => {
      // 快照只来自 Amazon 搜索页。把 Amazon 的实测价摆在 Shopee/TikTok 基准价旁边
      // 是在比两个不同平台的商品，会得出错误的偏离结论。
      if (!o.platform.toLowerCase().includes("amazon")) return;

      const keyword = o.nameEn || o.nameZh;
      let snapshots;
      try {
        snapshots = await store.getListingSnapshots({
          marketCode: o.marketCode,
          keyword,
          maxAgeMs: LISTING_TTL_MS,
        });
      } catch {
        return; // 快照读取失败不应让整页挂掉
      }
      if (snapshots.length === 0) return;

      const listings = snapshots.map((s) => ({
        asin: s.asin,
        title: s.title,
        price: s.price,
        rating: s.rating,
        reviewCount: s.reviewCount,
        url: s.url,
      }));
      const median = medianPrice(listings);
      if (median === null) return;

      const rep = listings.reduce((best, l) =>
        Math.abs(l.price - median) < Math.abs(best.price - median) ? l : best,
      );
      out.set(o.marketCode, {
        actual: +median.toFixed(2),
        deviationPct: o.sellPriceLocal > 0 ? ((median - o.sellPriceLocal) / o.sellPriceLocal) * 100 : null,
        representative: { title: rep.title, price: rep.price, url: rep.url },
        sampleCount: listings.length,
        fetchedAt: snapshots.reduce((a, b) => (b.fetchedAt > a.fetchedAt ? b : a)).fetchedAt,
      });
    }),
  );

  return out;
}

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
  const rate = cnyPerUsd(catalog.fx);
  const watched = selected
    ? (await getWatchlistItems()).some((w) => w.productId === product.id && w.marketId === selected.marketId)
    : false;
  const sources = await loadPriceSources(opps);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1530]/80">
          <img src={product.imageUrl} alt={product.nameZh} className="h-64 w-full object-cover" />
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-slate-300">{category?.nameZh}</span>
              <span className="rounded-lg bg-sky-400/10 px-2 py-1 text-sky-300">{product.supplierPlatform}</span>
              <span
                className={`rounded-lg px-2 py-1 ${
                  product.trend === "rising"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : product.trend === "falling"
                      ? "bg-rose-400/10 text-rose-300"
                      : "bg-slate-800 text-slate-400"
                }`}
              >
                {product.trend === "rising" ? "需求上升" : product.trend === "falling" ? "需求回落" : "需求平稳"}
              </span>
            </div>
            <h1 className="text-2xl font-black">{product.nameZh}</h1>
            <p className="text-sm leading-6 text-slate-400">{product.description}</p>
            <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Info k="货源价" v={`¥${product.sourcePriceCny.toFixed(2)}`} />
              <Info k="MOQ" v={String(product.moq)} />
              <Info k="重量" v={`${product.weightKg} kg`} />
              <Info k="体积" v={`${product.volumeCbm} cbm`} />
              <Info k="HS" v={product.hsCode} />
              <Info k="交期" v={`${product.leadDays} 天`} />
              <Info k="认证" v={product.certifications} />
              <Info k="IP 风险" v={product.ipRisk} />
            </dl>
            <p className="text-xs text-slate-500">
              供应商 {product.supplierName} · SKU {product.sku}
            </p>
            <div className="rounded-xl border border-slate-800 bg-[#0a1226] p-3">
              <PlatformLinks title="🇨🇳 去采购端核价" links={sourcingLinks(product.nameZh)} compact />
            </div>
          </div>
        </div>

        {selected ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.28em] text-amber-300">FULL LANDED COST</p>
                <h2 className="mt-1 text-xl font-black">
                  {selected.flag} {selected.marketName} · {selected.platform}
                </h2>
              </div>
              <Verdict verdict={selected.result.verdict} />
            </div>
            <p className="mt-2 text-sm text-slate-400">{selected.result.verdictLabel}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Info k="净利润" v={money(selected.result.netProfitUsd)} />
              <Info k="利润率" v={pct(selected.result.marginPct)} />
              <Info k="ROI" v={pct(selected.result.roiPct)} />
            </div>
            <div className="mt-5">
              <Waterfall
                lines={selected.result.lines}
                landed={selected.result.landedUsd}
                sell={selected.result.sellUsd}
                net={selected.result.netProfitUsd}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <WatchButton productId={product.id} marketId={selected.marketId} watched={watched} />
              <Link
                href={`/calculator?sku=${product.sku}&market=${selected.marketCode}`}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
              >
                在计算器中打开
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">暂无市场报价。</p>
        )}
      </div>

      <h2 className="mt-10 mb-2 text-xl font-black">同一货源，不同国家</h2>
      <p className="mb-4 text-xs leading-6 text-slate-400">
        售价列为<b className="text-slate-200">模型基准值</b>。「价格来源」列给出可点击的外部站点：
        已抓取过的市场直接链到<b className="text-slate-200">真实商品页</b>并显示实测中位价与偏离；
        未抓取的给该平台搜索链接供你自行核价——搜索链接不代表该基准价的出处。
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#0c1530] text-left text-xs font-bold text-slate-400">
            <tr>
              <th className="p-3">市场</th>
              <th className="p-3">平台</th>
              <th className="p-3">售价（基准）</th>
              <th className="p-3">价格来源</th>
              <th className="p-3">月销</th>
              <th className="p-3">物流</th>
              <th className="p-3">净利</th>
              <th className="p-3">利润率</th>
              <th className="p-3">判定</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => {
              const src = sources.get(o.marketCode);
              const links = sellingLinks(o.marketCode, o.nameEn || o.nameZh);
              const active = o.marketCode === selected?.marketCode;
              return (
                <tr
                  key={`${o.marketCode}-${o.platform}`}
                  className={`border-t border-slate-800 ${active ? "bg-[#0e1836]" : "bg-[#0a1226]"}`}
                >
                  <td className="p-3">
                    <Link href={`/products/${product.id}?market=${o.marketCode}`} className="font-bold hover:underline">
                      {o.flag} {o.marketName}
                    </Link>
                  </td>
                  <td className="p-3 text-slate-400">{o.platform}</td>
                  <td className="num p-3">
                    {o.currency} {o.sellPriceLocal}
                  </td>

                  <td className="p-3">
                    {src?.representative ? (
                      <div className="space-y-1">
                        <a
                          href={src.representative.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex max-w-[260px] items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300 hover:brightness-125"
                          title={src.representative.title}
                        >
                          <span className="num shrink-0 font-bold">
                            实测 {o.currency} {src.actual}
                          </span>
                          <span className="truncate opacity-70">{src.representative.title}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                        <p className="num text-[10px] text-slate-500">
                          {src.sampleCount} 件样本
                          {src.deviationPct !== null ? (
                            <span className={src.deviationPct < -5 ? " text-rose-300" : src.deviationPct > 5 ? " text-emerald-300" : ""}>
                              {" "}
                              · 基准{src.deviationPct > 0 ? "低" : "高"}估 {Math.abs(src.deviationPct).toFixed(0)}%
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <PlatformLinks links={links} compact />
                        <p className="text-[10px] text-slate-600">
                          {o.platform.toLowerCase().includes("amazon")
                            ? "尚无实测快照，点上方去核价"
                            : `${o.platform} 暂不支持自动抓价，点上方去核价`}
                        </p>
                      </div>
                    )}
                  </td>

                  <td className="num p-3 text-slate-400">{o.monthlySales}</td>
                  <td className="p-3 text-slate-400">{o.shippingLabel}</td>
                  <td className="num p-3">
                    {money(o.result.netProfitUsd)}
                    <span className="ml-1 text-[11px] text-slate-500">¥{(o.result.netProfitUsd * rate).toFixed(0)}</span>
                  </td>
                  <td className="num p-3">{pct(o.result.marginPct)}</td>
                  <td className="p-3">
                    <Verdict verdict={o.result.verdict} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a1226] p-2.5">
      <dt className="text-[11px] text-slate-500">{k}</dt>
      <dd className="num mt-0.5 text-sm">{v}</dd>
    </div>
  );
}
