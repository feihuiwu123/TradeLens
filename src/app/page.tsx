import Link from "next/link";
import { OpportunityCard, SectionTitle } from "@/components/ui";
import { buildOpportunities, loadCatalog } from "@/lib/catalog";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await loadCatalog();
  const opps = buildOpportunities(catalog);
  const go = opps.filter((o) => o.result.verdict === "go").slice(0, 6);
  const avgMargin = go.reduce((s, o) => s + o.result.marginPct, 0) / Math.max(go.length, 1);
  const markets = catalog.markets.length;
  const products = catalog.products.length;

  return (
    <main>
      <section className="relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/3848789/pexels-photo-3848789.jpeg?auto=compress&cs=tinysrgb&w=1800"
          alt="港口集装箱"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#071018]/30 via-[#071018]/70 to-[#071018]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
          <div>
            <p className="font-display text-sm tracking-[0.35em] text-[var(--gold)]">CHINA × WORLD SPREAD ENGINE</p>
            <h1 className="font-serif mt-4 text-5xl leading-[1.05] md:text-7xl">
              贸易的前提是利润。
              <span className="block text-[var(--gold-2)]">利润来自需求与差价。</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
              贸差眼把 1688 货源价、目标国售价、海空运、HS 关税、VAT、平台佣金、广告和退货摊进同一张表。没有需求的差价不是利润，没算清关税的利润只是幻觉。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/opportunities" className="rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[#071018]">
                打开机会雷达
              </Link>
              <Link href="/assistant" className="rounded-full border border-[var(--line)] px-6 py-3 text-sm">
                问贸差眼助手
              </Link>
              <Link href="/tools" className="rounded-full border border-[var(--line)] px-6 py-3 text-sm">
                接入 Hermes
              </Link>
            </div>
          </div>
          <div className="panel rounded-3xl p-6">
            <p className="text-xs tracking-[0.2em] text-[var(--gold)]">LIVE ENGINE</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Stat k="可做机会" v={String(opps.filter((o) => o.result.verdict === "go").length)} />
              <Stat k="目标市场" v={String(markets)} />
              <Stat k="样本货源" v={String(products)} />
              <Stat k="高分均利润率" v={pct(avgMargin)} />
            </div>
            <p className="mt-6 text-sm text-[var(--muted)]">
              默认路径：轻小件走快递测款，验证后再空运/海运海外仓。美国对中国小额免税已按 0 处理。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <SectionTitle
          kicker="EXISTING TOOLS"
          title="现成工具有，但没有一张完整利润表"
          desc="插件能比价，选品软件能看销量，计算器能填费用。缺的是把中国货源到多国落地成本一次性算清，并让 Hermes 直接调用。"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["店雷达 / Sorftime", "1688 图搜反查 Amazon、TikTok、Shopee，强在找同款，弱在关税与头程模型不透明。"],
            ["SourceCalc", "1688 页内利润插件，含运费关税粗算，覆盖国家少，没有需求雷达。"],
            ["Helium 10 / Keepa", "Amazon 需求与费用权威，但不含 1688 货源、头程和海关。"],
            ["SourceMogul / Cyclops", "英美零售或 Amazon 站点互倒，不是中国供应链出发。"],
            ["超热卖利润计算器", "Amazon 费用拆得很细，采购价与运费要手工填。"],
            ["贸差眼要补的缺口", "货源 × 需求 × 关税 × 运费 × 平台费同一引擎，并开放 API 给个人助手。"],
          ].map(([t, d]) => (
            <article key={t} className="panel rounded-3xl p-6">
              <h3 className="font-serif text-2xl">{t}</h3>
              <p className="mt-3 text-sm text-[var(--muted)]">{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex items-end justify-between gap-4">
          <SectionTitle kicker="SPREAD RADAR" title="此刻全成本后仍有安全垫的机会" />
          <Link href="/opportunities" className="mb-8 text-sm text-[var(--gold)]">
            查看全部 →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {go.map((o) => (
            <OpportunityCard key={`${o.productId}-${o.marketCode}-${o.platform}`} o={o} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <SectionTitle kicker="PRODUCT RANGE" title="先做这十类，而不是什么便宜拿什么" />
        <div className="grid gap-4 md:grid-cols-2">
          {catalog.categories.map((c) => (
            <article key={c.slug} className="panel flex gap-5 rounded-3xl p-5">
              <div className="font-display text-[var(--gold)]">{c.hsChapter}</div>
              <div>
                <h3 className="font-serif text-xl">{c.nameZh}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.reason}</p>
                <p className="mt-2 text-xs text-[var(--gold)]">
                  {c.weightClass} · 风险 {c.riskLevel} · HS {c.typicalHs}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] px-5">
        <div className="panel grid gap-8 rounded-[2.5rem] p-8 md:grid-cols-2 md:p-12">
          <div>
            <p className="font-display text-xs tracking-[0.28em] text-[var(--gold)]">HOW PROFIT IS MADE</p>
            <h2 className="font-serif mt-3 text-4xl">同一件货，四种路径，利润完全不同</h2>
            <p className="mt-4 text-[var(--muted)]">
              以宠物慢食碗为例：美国 Amazon 售价 $16.99，1688 约 ¥12.6。快递测款能看转化，海运海外仓才能放大利润率。瑜伽垫则几乎只能走海运。
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/calculator" className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm text-[#071018]">
                打开全成本计算器
              </Link>
              <Link href="/prd" className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm">
                阅读 PRD
              </Link>
            </div>
          </div>
          <img
            src="https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="海外仓"
            className="h-72 w-full rounded-3xl object-cover"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <SectionTitle kicker="HERMES READY" title="算完之后，把决策交给个人助手" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1. 扫描", "Hermes 调用 /api/opportunities，按市场、类目、最低利润率过滤。"],
            ["2. 核算", "对候选 SKU 调 /api/calculator，强制计入关税与运费，禁止口头估算。"],
            ["3. 落地", "查 /api/customs 与 /api/shipping，生成采购清单、物流方式和观察名单。"],
          ].map(([t, d]) => (
            <article key={t} className="panel rounded-3xl p-6">
              <h3 className="font-serif text-2xl">{t}</h3>
              <p className="mt-3 text-[var(--muted)]">{d}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-4">
      <p className="text-xs text-[var(--muted)]">{k}</p>
      <p className="font-serif num mt-1 text-3xl text-[var(--gold-2)]">{v}</p>
    </div>
  );
}
