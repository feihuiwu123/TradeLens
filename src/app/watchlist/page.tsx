import Link from "next/link";
import { SectionTitle, Verdict } from "@/components/ui";
import { WatchButton } from "@/components/watch-button";
import { buildOpportunities, getSavedCalcs, getWatchlistItems, loadCatalog } from "@/lib/catalog";
import { money, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const catalog = await loadCatalog();
  const [watched, calcs] = await Promise.all([getWatchlistItems(), getSavedCalcs()]);
  const opps = buildOpportunities(catalog);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="WATCHLIST"
        title="观察名单与利润档案"
        desc="把高分机会钉住，让 Hermes 或你自己每天只看变化，而不是重新翻 1688。"
      />
      <div className="space-y-4">
        {watched.length === 0 ? (
          <p className="panel rounded-3xl p-8 text-[var(--muted)]">还没有观察项。去机会雷达或货源详情里添加。</p>
        ) : (
          watched.map((w) => {
            const o = opps.find((x) => x.productId === w.productId && x.marketId === w.marketId);
            const product = catalog.products.find((p) => p.id === w.productId);
            if (!product) return null;
            return (
              <article key={w.id} className="panel flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center">
                <img src={product.imageUrl} alt="" className="h-24 w-36 rounded-2xl object-cover" />
                <div className="flex-1">
                  <Link href={`/products/${product.id}?market=${o?.marketCode ?? ""}`} className="font-serif text-2xl">
                    {product.nameZh}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {o ? `${o.flag} ${o.marketName} · ${o.platform}` : "等待匹配市场"} · {w.note || "无备注"}
                  </p>
                </div>
                {o ? (
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="num text-xl">{money(o.result.netProfitUsd)}</p>
                      <p className="text-xs text-[var(--muted)]">{pct(o.result.marginPct)}</p>
                    </div>
                    <Verdict verdict={o.result.verdict} />
                  </div>
                ) : null}
                <WatchButton productId={w.productId} marketId={w.marketId} watched />
              </article>
            );
          })
        )}
      </div>

      <h2 className="font-serif mt-12 mb-5 text-3xl">保存的测算</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {calcs.length === 0 ? (
          <p className="text-[var(--muted)]">计算器里保存测算后会出现在这里。</p>
        ) : (
          calcs.map((c) => (
            <article key={c.id} className="panel rounded-3xl p-5">
              <h3 className="font-serif text-xl">{c.title}</h3>
              <p className="mt-2 num text-[var(--gold)]">
                {money(c.netProfitUsd)} · {pct(c.marginPct)}
              </p>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
