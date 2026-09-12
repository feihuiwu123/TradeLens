import { SectionTitle } from "@/components/ui";
import { buildOpportunities, loadCatalog } from "@/lib/catalog";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const catalog = await loadCatalog();
  const opps = buildOpportunities(catalog);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="MARKETS"
        title="12 个目标市场的需求与税负"
        desc="先看需求指数和物流，再看增值税能不能当作代收。竞争低的市场往往清关更折腾，分数需要一起看。"
      />
      <div className="grid gap-5 md:grid-cols-2">
        {catalog.markets.map((m) => {
          const local = opps.filter((o) => o.marketId === m.id);
          const go = local.filter((o) => o.result.verdict === "go").length;
          return (
            <article key={m.code} className="panel rounded-[2rem] p-6">
              <div className="flex items-start justify-between">
                <h2 className="font-serif text-3xl">
                  {m.flag} {m.nameZh}
                </h2>
                <span className="text-sm text-[var(--gold)]">{m.currency}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">{m.notes}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Cell k="需求" v={String(m.demandIndex)} />
                <Cell k="竞争" v={String(m.competitionIndex)} />
                <Cell k="物流" v={String(m.logisticsScore)} />
                <Cell k="VAT/GST" v={pct(m.vatRate * 100)} />
                <Cell k="低值免税 $" v={String(m.deMinimisUsd)} />
                <Cell k="可做机会" v={String(go)} />
              </dl>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <dt className="text-xs text-[var(--muted)]">{k}</dt>
      <dd className="num mt-1 text-lg">{v}</dd>
    </div>
  );
}
