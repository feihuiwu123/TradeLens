import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { buildOpportunities, cnyPerUsd, loadCatalog } from "@/lib/catalog";
import { gradeOf } from "@/lib/profit";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const FORMULA = [
  "🇨🇳 采购价",
  "＋ 🚢 运费",
  "＋ 🛃 关税VAT",
  "＋ 🏪 平台费",
  "＋ 📣 广告退货",
  "＝ 💰 真成本",
  "→ 📊 对比多国售价",
  "→ ✅ S级 verdict",
];

export default async function HomePage() {
  const catalog = await loadCatalog();
  const opps = buildOpportunities(catalog);
  const rate = cnyPerUsd(catalog.fx);
  const go = opps.filter((o) => o.result.verdict === "go");
  const top = go.slice(0, 6);
  const avgMargin = go.reduce((s, o) => s + o.result.marginPct, 0) / Math.max(go.length, 1);

  // 标题里的两个数字取自当前最高分机会，不写死——数据变了标题跟着变。
  const lead = opps[0];
  const leadBuy = lead ? Math.round(lead.sourcePriceCny) : 0;
  const leadSell = lead ? Math.round(lead.result.sellUsd * rate) : 0;

  return (
    <main>
      {/* Hero */}
      <section className="bg-grid relative overflow-hidden border-b border-slate-800/60">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[720px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            利润 = 差价 × 需求 − 全链路成本 · 引擎已就绪
          </p>

          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight md:text-5xl">
            {lead ? (
              <>
                中国进货 <span className="gold-text">¥{leadBuy}</span>，{lead.marketName}卖{" "}
                <span className="gold-text">¥{leadSell}</span>，
                <br className="hidden md:block" />
                扣完税费运费还赚多少？
              </>
            ) : (
              <>贸易的前提是利润，利润来自需求与差价。</>
            )}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-[15px]">
            贸差眼把
            <b className="text-slate-100">
              {" "}
              中国采购价、{catalog.markets.length}国售价、4种物流运费、关税VAT、平台佣金、广告退货、需求指数{" "}
            </b>
            一次算清，每条机会直接给 S/A/B/C 评级 verdict。先看榜单，再用测算器验证，最后让 Hermes 助手帮你定打法。
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/calculator"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 text-sm font-extrabold text-slate-900 hover:brightness-110"
            >
              去验证我的产品 <ArrowRight size={15} />
            </Link>
            <Link
              href="/assistant"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              问 Hermes：新手怎么做？
            </Link>
            <Link
              href="/tools"
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              先看现有工具有哪些
            </Link>
          </div>

          {/* 公式条 */}
          <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs">
            {FORMULA.map((s, i) => (
              <span
                key={s}
                className={`rounded-lg px-2.5 py-1.5 font-bold ${
                  i >= 5 ? "bg-amber-400/15 text-amber-200" : "bg-slate-800/80 text-slate-300"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* 统计条 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { k: "可做机会", v: String(go.length), s: "全链路成本后仍有安全垫" },
            { k: "目标市场", v: String(catalog.markets.length), s: "跨国售价对比" },
            { k: "样本货源", v: String(catalog.products.length), s: "中国产业带" },
            { k: "高分均净利率", v: pct(avgMargin, 1), s: "可做机会平均" },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
              <p className="text-xs text-slate-400">{s.k}</p>
              <p className="num mt-1 text-2xl font-extrabold text-amber-300">{s.v}</p>
              <p className="text-xs text-slate-500">{s.s}</p>
            </div>
          ))}
        </div>

        {/* 榜单预览 */}
        <div className="mt-8 flex items-end justify-between gap-4">
          <SectionTitle kicker="SPREAD RADAR" title="此刻全成本后仍有安全垫的机会" />
          <Link href="/opportunities" className="mb-6 shrink-0 text-sm font-bold text-amber-300">
            查看全部 →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          {top.map((o) => {
            const g = gradeOf(o.score);
            return (
              <Link
                key={`${o.productId}-${o.marketCode}-${o.platform}`}
                href={`/products/${o.productId}?market=${o.marketCode}`}
                className="card-glow flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#0a1226] px-4 py-3 transition first:border-t-0 hover:bg-[#0e1836]"
              >
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-bold text-slate-100">{o.nameZh}</p>
                  <p className="num text-xs text-slate-500">
                    {o.sku} · ¥{o.sourcePriceCny.toFixed(0)} <ArrowRight size={10} className="inline" /> ¥
                    {(o.result.sellUsd * rate).toFixed(0)}
                  </p>
                </div>
                <p className="text-sm font-bold">
                  {o.flag} {o.marketName}
                </p>
                <p className="num text-lg font-extrabold text-emerald-300">
                  ¥{(o.result.netProfitUsd * rate).toFixed(1)}
                  <span className="text-xs font-normal text-slate-400">/件</span>
                </p>
                <p className="num text-xs text-slate-400">净利率 {pct(o.result.marginPct, 1)}</p>
                <span
                  className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-extrabold"
                  style={{ background: `${g.color}22`, color: g.color, border: `1px solid ${g.color}55` }}
                >
                  {g.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* 现有工具 */}
        <section className="mt-12">
          <SectionTitle
            kicker="EXISTING TOOLS"
            title="现成工具有，但没有一张完整利润表"
            desc="插件能比价，选品软件能看销量，计算器能填费用。缺的是把中国货源到多国落地成本一次性算清，并让 Hermes 直接调用。"
          />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["店雷达 / Sorftime", "1688 图搜反查 Amazon、TikTok、Shopee，强在找同款，弱在关税与头程模型不透明。"],
              ["SourceCalc", "1688 页内利润插件，含运费关税粗算，覆盖国家少，没有需求雷达。"],
              ["Helium 10 / Keepa", "Amazon 需求与费用权威，但不含 1688 货源、头程和海关。"],
              ["SourceMogul / Cyclops", "英美零售或 Amazon 站点互倒，不是中国供应链出发。"],
              ["超热卖利润计算器", "Amazon 费用拆得很细，采购价与运费要手工填。"],
              ["贸差眼要补的缺口", "货源 × 需求 × 关税 × 运费 × 平台费同一引擎，并开放 API 给个人助手。"],
            ].map(([t, d]) => (
              <article key={t} className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-5">
                <h3 className="text-base font-extrabold text-slate-100">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 品类范围 */}
        <section className="mt-12">
          <SectionTitle kicker="PRODUCT RANGE" title="先做这几类，而不是什么便宜拿什么" />
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.categories.map((c) => (
              <article key={c.slug} className="flex gap-4 rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
                <div className="num text-lg font-black text-amber-300">{c.hsChapter}</div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100">{c.nameZh}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{c.reason}</p>
                  <p className="mt-1.5 text-xs text-amber-300/80">
                    {c.weightClass} · 风险 {c.riskLevel} · HS {c.typicalHs}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Hermes */}
        <section className="mt-12">
          <SectionTitle kicker="HERMES READY" title="算完之后，把决策交给个人助手" />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["1. 扫描", "Hermes 调用 /api/opportunities，按市场、类目、最低利润率过滤。"],
              ["2. 核算", "对候选 SKU 调 /api/calculator，强制计入关税与运费，禁止口头估算。"],
              ["3. 落地", "查 /api/customs 与 /api/shipping，生成采购清单、物流方式和观察名单。"],
            ].map(([t, d]) => (
              <article key={t} className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-5">
                <h3 className="text-base font-extrabold text-slate-100">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{d}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
