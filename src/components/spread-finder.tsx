"use client";

import { useState } from "react";
import { ExternalLink, Layers, Plus, Search, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { PlatformLinks } from "@/components/platform-links";
import { sellingLinks, sourcingLinks } from "@/lib/marketplace-urls";

type Row = {
  market: string;
  marketName: string;
  platform: string;
  sellPriceLocal: number;
  currency: string;
  sellPriceCny: number;
  grossSpreadPct: number;
  netProfitCny: number;
  marginPct: number;
  roiPct: number;
  dutyPct: number;
  vatPct: number;
  shipping: string;
  verdict: "go" | "thin" | "no";
  grade: string;
  underDeMinimis: boolean;
  deMinimisUsd: number;
  source: string;
  title?: string;
  url?: string;
  priceStats?: { min: number; max: number; spread: number; mixed: boolean } | null;
  tier?: { band: { min: number; max: number }; excludedAbove: number; excludedBelow: number; applied: boolean } | null;
  listings?: {
    asin: string;
    title: string;
    price: number;
    rating: number | null;
    reviewCount: number | null;
    url: string;
  }[];
};

type Report = {
  count: number;
  best: { market: string; netProfitCny: number; grade: string } | null;
  rows: Row[];
  skipped: { marketCode: string; reason: string }[];
  comparabilityWarning: string | null;
};

const GRADE_COLOR: Record<string, string> = {
  S: "#34d399",
  A: "#38bdf8",
  B: "#fbbf24",
  C: "#fb7185",
};

/** de minimis 最高的三国优先——门槛是跨境套利最大的单一变量 */
const DEFAULT_QUOTES = [
  { market: "AU", sellPrice: "" },
  { market: "SG", sellPrice: "" },
  { market: "AE", sellPrice: "" },
];

export type TaxonomyNode = {
  slug: string;
  nameZh: string;
  subcategories: {
    slug: string;
    nameZh: string;
    hsCode: string;
    hsVerified: boolean;
    typicalWeightKg: number;
    typicalVolumeCbm: number;
    logisticsFlag: string;
    complianceLevel: string;
    requiredCerts: string;
    note: string;
  }[];
};

const FLAG_LABEL: Record<string, string> = {
  volumetric: "抛货 · 禁走快递",
  heavy: "重货 · 仅海运",
  battery: "含电 · 空运受限",
};

export function SpreadFinder({
  markets,
  tree,
}: {
  markets: { code: string; nameZh: string; flag: string }[];
  tree: TaxonomyNode[];
}) {
  const [catSlug, setCatSlug] = useState("");
  const [subSlug, setSubSlug] = useState("");
  const [certs, setCerts] = useState("");
  const [nameZh, setNameZh] = useState("私模半入耳蓝牙耳机");
  const [sourcePriceCny, setSourcePriceCny] = useState("28.5");
  const [weightKg, setWeightKg] = useState("0.085");
  const [volumeCbm, setVolumeCbm] = useState("0.0004");
  const [hsCode, setHsCode] = useState("8518.30");
  const [quotes, setQuotes] = useState(DEFAULT_QUOTES);
  /** 自动模式：按关键词抓各站真实在售商品，价格与链接严格对应 */
  const [auto, setAuto] = useState(false);
  const [autoKeyword, setAutoKeyword] = useState("wireless earbuds");
  const [tierFilter, setTierFilter] = useState(true);
  const [maxTierMultiple, setMaxTierMultiple] = useState("12");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subs = tree.find((c) => c.slug === catSlug)?.subcategories ?? [];
  const sub = subs.find((s) => s.slug === subSlug);

  /** block 级且未提供任一所需证书 → 硬拦截，不允许测算 */
  const requiredCerts = (sub?.requiredCerts ?? "")
    .split(/[,/;，、]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const heldCerts = certs.split(/[,，\s]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
  const certSatisfied =
    requiredCerts.length === 0 ||
    requiredCerts.some((r) => heldCerts.some((h) => r.toLowerCase().includes(h) || h.includes(r.toLowerCase())));
  const blocked = sub?.complianceLevel === "block" && !certSatisfied;

  /** 选中子类目后预填 HS 与典型重量体积，省掉用户查编码 */
  function applySub(slug: string) {
    setSubSlug(slug);
    const s = subs.find((x) => x.slug === slug);
    if (!s) return;
    setHsCode(s.hsCode);
    setWeightKg(String(s.typicalWeightKg));
    setVolumeCbm(String(s.typicalVolumeCbm));
    if (nameZh === "" ) setNameZh(s.nameZh);
  }

  async function run() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const probeBody = {
        nameZh,
        sourcePriceCny: Number(sourcePriceCny),
        weightKg: Number(weightKg),
        volumeCbm: Number(volumeCbm),
        hsCode: hsCode.trim(),
      };
      const body = auto
        ? {
            probe: probeBody,
            // 关键词解析真实在售商品：每个市场抓一次搜索页
            keyword: (autoKeyword.trim() || nameZh).trim(),
            tierFilter,
            maxTierMultiple: Number(maxTierMultiple) || 12,
            markets: quotes.filter((q) => q.market).map((q) => q.market),
          }
        : {
            probe: probeBody,
            quotes: quotes
              .filter((q) => q.market && Number(q.sellPrice) > 0)
              .map((q) => ({ market: q.market, sellPrice: Number(q.sellPrice) })),
          };
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("；") ?? json.error ?? "请求失败");
        return;
      }
      setReport(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fadeup">
      {/* 类目 → 子类目级联 */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
          <Layers size={15} /> 选类目
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-normal text-slate-400">
            选中后自动带出 HS 编码与典型重量体积
          </span>
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={catSlug}
            onChange={(e) => {
              setCatSlug(e.target.value);
              setSubSlug("");
            }}
          >
            <option value="">选择类目…</option>
            {tree.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameZh}（{c.subcategories.length}）
              </option>
            ))}
          </select>
          <select value={subSlug} onChange={(e) => applySub(e.target.value)} disabled={!catSlug}>
            <option value="">{catSlug ? "选择子类目…" : "先选类目"}</option>
            {subs.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.complianceLevel === "block" ? "🔴 " : s.complianceLevel === "warn" ? "⚠️ " : ""}
                {s.nameZh} · HS {s.hsCode}
              </option>
            ))}
          </select>
        </div>

        {sub ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-slate-300">HS {sub.hsCode}</span>
              {!sub.hsVerified ? (
                <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-amber-200">
                  编码未经官方税则库校验，仅作起点
                </span>
              ) : null}
              {FLAG_LABEL[sub.logisticsFlag] ? (
                <span className="rounded-lg bg-orange-400/15 px-2 py-1 text-orange-300">
                  {FLAG_LABEL[sub.logisticsFlag]}
                </span>
              ) : null}
            </div>
            {sub.note ? <p className="text-xs leading-6 text-slate-400">{sub.note}</p> : null}
            {requiredCerts.length > 0 ? (
              <label className="block text-xs text-slate-400">
                需要认证：<b className="text-slate-200">{requiredCerts.join(" / ")}</b>
                <input
                  value={certs}
                  onChange={(e) => setCerts(e.target.value)}
                  placeholder="填入已持有的认证以解锁，如 CPC 或 EN71"
                  className="mt-1"
                />
              </label>
            ) : null}
            {blocked ? (
              <p className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-400/10 p-3 text-xs leading-6 text-rose-200">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b>该品类禁止进入候选池。</b>
                  属强制认证品类，未取得 {requiredCerts.join(" / ")} 任一证书前不得备货——
                  无证不是利润薄，是货被扣、店被封、资金被冻结。
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
          <Search size={15} /> 中国货源
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="md:col-span-2 text-xs text-slate-400">
            品名
            <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-slate-400">
            采购价 ¥
            <input value={sourcePriceCny} onChange={(e) => setSourcePriceCny(e.target.value)} className="mt-1" inputMode="decimal" />
          </label>
          <label className="text-xs text-slate-400">
            重量 kg
            <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="mt-1" inputMode="decimal" />
          </label>
          <label className="text-xs text-slate-400">
            体积 cbm
            <input value={volumeCbm} onChange={(e) => setVolumeCbm(e.target.value)} className="mt-1" inputMode="decimal" />
          </label>
          <label className="text-xs text-slate-400">
            HS 编码
            <input value={hsCode} onChange={(e) => setHsCode(e.target.value)} className="mt-1" placeholder="8518.30" />
          </label>
        </div>

        {nameZh.trim() ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-[#0a1226] p-3">
            <PlatformLinks title="🇨🇳 去采购端查货源价" links={sourcingLinks(nameZh)} compact />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-amber-200">各国在售价</span>
          <div className="flex rounded-lg bg-slate-800 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setAuto(false)}
              className={`rounded-md px-2.5 py-1 ${!auto ? "bg-amber-400 font-bold text-slate-900" : "text-slate-300"}`}
            >
              手工填价
            </button>
            <button
              type="button"
              onClick={() => setAuto(true)}
              className={`rounded-md px-2.5 py-1 ${auto ? "bg-amber-400 font-bold text-slate-900" : "text-slate-300"}`}
            >
              自动抓真实商品
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            {auto ? "每个市场抓一次搜索页，价格与商品链接严格对应" : "自己填最准 · 零外部调用"}
          </span>
        </div>

        {auto ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-slate-400">
              搜索关键词（用目标市场的语言，英文站点填英文）
              <input
                value={autoKeyword}
                onChange={(e) => setAutoKeyword(e.target.value)}
                placeholder="wireless earbuds"
                className="mt-1"
              />
            </label>
            <label className="flex items-start gap-2 rounded-xl border border-slate-700 bg-[#0a1226] p-3 text-[11px] leading-6 text-slate-400">
              <input
                type="checkbox"
                checked={tierFilter}
                onChange={(e) => setTierFilter(e.target.checked)}
                className="mt-1 !w-auto"
              />
              <span>
                <b className="text-slate-200">只保留同档位商品</b>（建议开启）。
                搜索结果常混入品牌货——拿 ¥{sourcePriceCny || "…"} 的白牌成本去对标 Anker 的售价，
                会算出你根本实现不了的利润率。开启后只保留
                <b className="text-slate-200">保本价</b>到<b className="text-slate-200">货源成本 {maxTierMultiple} 倍</b>
                区间内的商品；若某市场同档位样本不足 3 件，该市场会被整体排除而不是给你一个失真的数字。
              </span>
            </label>
            {tierFilter ? (
              <label className="block text-xs text-slate-400">
                档位上界：售价超过货源成本的多少倍即判为另一档位
                <input
                  value={maxTierMultiple}
                  onChange={(e) => setMaxTierMultiple(e.target.value)}
                  inputMode="decimal"
                  className="mt-1"
                />
              </label>
            ) : null}
            <p className="rounded-xl border border-slate-700 bg-[#0a1226] p-3 text-[11px] leading-6 text-slate-400">
              各站搜索结果本就是不同商品，所以这<b className="text-slate-200">不是同一商品的跨国比价</b>，
              而是该品类在各市场的<b className="text-slate-200">价格水位</b>。下方会列出全部真实商品供你点开核对。
            </p>
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          {quotes.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={q.market}
                onChange={(e) => setQuotes(quotes.map((x, j) => (j === i ? { ...x, market: e.target.value } : x)))}
                className="!w-auto"
              >
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.flag} {m.nameZh}
                  </option>
                ))}
              </select>
              {auto ? (
                <span className="flex-1 rounded-xl border border-dashed border-slate-700 px-3 py-2.5 text-xs text-slate-500">
                  价格将从该站搜索结果自动解析
                </span>
              ) : (
                <input
                  value={q.sellPrice}
                  onChange={(e) => setQuotes(quotes.map((x, j) => (j === i ? { ...x, sellPrice: e.target.value } : x)))}
                  placeholder="当地币种售价，如 19.99"
                  inputMode="decimal"
                />
              )}
              <button
                type="button"
                onClick={() => setQuotes(quotes.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg bg-slate-800 p-2 text-slate-400 hover:bg-slate-700"
                aria-label="删除"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* 让用户能直接跳去对应站点查这个价，而不用自己拼域名 */}
        {nameZh.trim() ? (
          <div className="mt-3 space-y-2">
            {quotes
              .filter((q) => q.market)
              .map((q, i) => {
                const links = sellingLinks(q.market, nameZh);
                if (links.length === 0) return null;
                return (
                  <div key={`${q.market}-${i}`} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] text-slate-500">{q.market}</span>
                    <PlatformLinks links={links} compact />
                  </div>
                );
              })}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setQuotes([...quotes, { market: "US", sellPrice: "" }])}
          className="mt-2 flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
        >
          <Plus size={13} /> 加一个市场
        </button>

        <button
          type="button"
          onClick={run}
          disabled={busy || blocked}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-sm font-extrabold text-slate-900 hover:brightness-110 disabled:opacity-50"
        >
          {blocked ? "该品类已被合规拦截" : busy ? "正在按全链路成本重算…" : "发现价差 →"}
        </button>

        {error ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-400/10 p-3 text-xs text-rose-200">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      {report ? (
        <div className="mt-4">
          {/* 可比性警告必须排在结论之前——先看到「澳洲 S 级」再看到警告就晚了 */}
          {report.comparabilityWarning ? (
            <div className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-400/10 p-4 text-xs leading-6 text-rose-200">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                <b>跨市场结果不可直接比较。</b>
                <br />
                {report.comparabilityWarning}
              </span>
            </div>
          ) : null}

          {report.best ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              最优市场 <b>{report.best.market}</b> · 单件净利{" "}
              <b className="num">¥{report.best.netProfitCny.toFixed(2)}</b> · {report.best.grade} 级
              <span className="ml-2 text-xs text-amber-200/70">排序按净利，不按毛差价</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-6 text-center text-sm text-slate-400">
              没有可测算的市场，检查下方原因。
            </div>
          )}

          {report.rows.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800">
              <div className="hidden grid-cols-12 gap-2 bg-[#0c1530] px-4 py-3 text-xs font-bold text-slate-400 md:grid">
                <div className="col-span-2">市场</div>
                <div className="col-span-2">售价 → 折人民币</div>
                <div className="col-span-2">毛差价</div>
                <div className="col-span-2">单件净利</div>
                <div className="col-span-2">税负 · 物流</div>
                <div className="col-span-2 text-right">评级</div>
              </div>
              {report.rows.map((r) => (
                <div
                  key={r.market}
                  className="grid-cols-12 gap-2 border-t border-slate-800 bg-[#0a1226] px-4 py-3 md:grid md:items-center"
                >
                  <div className="col-span-2">
                    <p className="text-sm font-bold">{r.marketName}</p>
                    <p className="text-xs text-slate-500">{r.platform}</p>
                  </div>
                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className="num text-sm text-sky-300">
                      {r.currency} {r.sellPriceLocal}
                    </p>
                    <p className="num text-xs text-slate-400">¥{r.sellPriceCny.toFixed(1)}</p>
                  </div>
                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className="num text-sm text-rose-300">+{r.grossSpreadPct.toFixed(0)}%</p>
                    <p className="text-[11px] text-slate-500">毛差价≠利润</p>
                  </div>
                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className={`num text-lg font-extrabold ${r.netProfitCny >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                      ¥{r.netProfitCny.toFixed(1)}
                    </p>
                    <p className="num text-xs text-slate-400">
                      净利率 {r.marginPct}% · ROI {r.roiPct}%
                    </p>
                  </div>
                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className="num text-xs text-slate-300">
                      关税 {r.dutyPct}% · VAT {r.vatPct}%
                    </p>
                    <p className="text-xs text-slate-500">{r.shipping}</p>
                    <p className={`text-[11px] ${r.underDeMinimis ? "text-emerald-400" : "text-slate-500"}`}>
                      {r.underDeMinimis ? `免税额内 <$${r.deMinimisUsd}` : "需正规计税"}
                    </p>
                  </div>
                  <div className="col-span-2 mt-2 text-left md:mt-0 md:text-right">
                    <span
                      className="inline-block rounded-lg px-2 py-1 text-xs font-extrabold"
                      style={{
                        background: `${GRADE_COLOR[r.grade]}22`,
                        color: GRADE_COLOR[r.grade],
                        border: `1px solid ${GRADE_COLOR[r.grade]}55`,
                      }}
                    >
                      {r.grade}
                    </span>
                    <p className="mt-1 text-[11px] text-slate-500">{r.source}</p>
                    {/* 抓取模式下 url 指向真正被抓取的那个商品，与本行价格严格对应 */}
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-1 inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300"
                        title="最接近中位数的那个真实商品"
                      >
                        代表商品 <ExternalLink size={10} />
                      </a>
                    ) : null}
                  </div>

                  {/* 真实在售商品样本：每条都是可点开核对的真商品 */}
                  {r.listings && r.listings.length > 0 ? (
                    <div className="col-span-12 mt-3 rounded-xl border border-slate-800 bg-[#0a1226] p-3">
                      <p className="mb-2 text-[11px] font-bold text-slate-400">
                        {r.marketName} 真实在售商品 {r.listings.length} 件（中位数 {r.currency}{" "}
                        {r.sellPriceLocal}
                        {r.priceStats ? (
                          <>
                            ，区间 {r.priceStats.min}–{r.priceStats.max}
                          </>
                        ) : null}
                        ）
                      </p>
                      {r.tier?.applied && r.tier.excludedAbove + r.tier.excludedBelow > 0 ? (
                        <p className="mb-2 rounded-lg bg-sky-400/10 px-2 py-1 text-[11px] leading-5 text-sky-200">
                          已按同档位筛选：保留 {r.currency} {r.tier.band.min}–{r.tier.band.max} 区间
                          （下界为按运费关税平台费算出的保本价）
                          {r.tier.excludedAbove > 0 ? `，剔除 ${r.tier.excludedAbove} 件更高档位的品牌货` : ""}
                          {r.tier.excludedBelow > 0 ? `，剔除 ${r.tier.excludedBelow} 件低于保本价的商品` : ""}
                        </p>
                      ) : null}
                      {r.priceStats?.mixed ? (
                        <p className="mb-2 rounded-lg bg-rose-400/10 px-2 py-1 text-[11px] text-rose-200">
                          价格跨度 {r.priceStats.spread} 倍，样本混有白牌与品牌 —— 中位数不代表你的货能卖到的价，
                          请在下方挑同档位商品对标
                        </p>
                      ) : null}
                      <div className="space-y-1">
                        {r.listings.map((l) => (
                          <a
                            key={l.asin}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-[#0e1836]"
                          >
                            <span className="num w-16 shrink-0 font-bold text-sky-300">
                              {r.currency} {l.price}
                            </span>
                            <span className="w-10 shrink-0 text-slate-500">
                              {l.rating ? `★${l.rating}` : "—"}
                            </span>
                            <span className="flex-1 truncate text-slate-300">{l.title}</span>
                            <ExternalLink size={10} className="shrink-0 text-slate-500" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {report.skipped.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
              <p className="text-xs font-bold text-slate-300">未能测算的市场</p>
              <ul className="mt-2 space-y-1">
                {report.skipped.map((s, i) => (
                  <li key={i} className="text-xs text-slate-400">
                    <b className="text-slate-300">{s.marketCode}</b> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
