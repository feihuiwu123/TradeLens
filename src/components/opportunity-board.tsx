"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Flame, Package, Search, Ship, TrendingUp, X } from "lucide-react";
import { LivePrice } from "@/components/live-price";
import { PlatformLinks } from "@/components/platform-links";
import { sellingLinks, sourcingLinks } from "@/lib/marketplace-urls";
import { gradeOf } from "@/lib/profit";
import type { Opportunity, ShippingMethod } from "@/lib/types";
import { compact, pct } from "@/lib/format";

const SORTS = [
  { key: "profit", label: "按单件净利排序" },
  { key: "margin", label: "按净利率排序" },
  { key: "demand", label: "按需求指数排序" },
  { key: "sales", label: "按预估月销排序" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

/**
 * 需求趋势图形。
 *
 * 注意：库里的 trend 只有 rising / stable / falling 三个方向，没有逐期历史数据。
 * 所以这里画的是「方向示意」，不是 6 期真实曲线——避免让人把示意图当成可下单的历史热度。
 * 真实可用的量化信号是旁边的需求分与月销。
 */
function TrendGlyph({ trend, demandScore }: { trend: string; demandScore: number }) {
  const w = 72;
  const h = 26;
  const color = demandScore >= 80 ? "#34d399" : demandScore >= 70 ? "#fbbf24" : "#94a3b8";
  const mid = h / 2;
  const points =
    trend === "rising"
      ? `2,${h - 4} ${w / 2},${mid} ${w - 2},4`
      : trend === "falling"
        ? `2,4 ${w / 2},${mid} ${w - 2},${h - 4}`
        : `2,${mid} ${w / 2},${mid - 1} ${w - 2},${mid}`;

  return (
    <svg width={w} height={h} aria-label={`需求趋势 ${trend}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w - 2} cy={trend === "rising" ? 4 : trend === "falling" ? h - 4 : mid} r="2.5" fill={color} />
    </svg>
  );
}

function GradeBadge({ score }: { score: number }) {
  const g = gradeOf(score);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs font-extrabold"
      style={{ background: `${g.color}22`, color: g.color, border: `1px solid ${g.color}55` }}
    >
      {g.label}
    </span>
  );
}

export function OpportunityBoard({
  items,
  markets,
  categories,
  cnyPerUsd,
}: {
  items: Opportunity[];
  markets: { code: string; nameZh: string; flag: string }[];
  categories: { slug: string; nameZh: string }[];
  cnyPerUsd: number;
}) {
  const [market, setMarket] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("profit");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Opportunity | null>(null);

  const cny = (usd: number) => usd * cnyPerUsd;

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const rows = items.filter((o) => {
      if (market !== "ALL" && o.marketCode !== market) return false;
      if (category !== "ALL" && o.categorySlug !== category) return false;
      if (method !== "ALL" && o.shippingMethod !== (method as ShippingMethod)) return false;
      if (keyword && !`${o.nameZh} ${o.nameEn} ${o.sku}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
    const by: Record<SortKey, (a: Opportunity, b: Opportunity) => number> = {
      profit: (a, b) => b.result.netProfitUsd - a.result.netProfitUsd,
      margin: (a, b) => b.result.marginPct - a.result.marginPct,
      demand: (a, b) => b.demandScore - a.demandScore,
      sales: (a, b) => b.monthlySales - a.monthlySales,
    };
    return [...rows].sort(by[sort]);
  }, [items, market, category, method, q, sort]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return { avgMargin: 0, sCount: 0, topProfit: 0 };
    return {
      avgMargin: filtered.reduce((s, o) => s + o.result.marginPct, 0) / filtered.length,
      sCount: filtered.filter((o) => gradeOf(o.score).grade === "S").length,
      topProfit: Math.max(...filtered.map((o) => o.result.netProfitUsd)),
    };
  }, [filtered]);

  return (
    <div className="animate-fadeup">
      {/* 筛选栏 */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索产品 / SKU，如：耳机、TD-PET-051"
              className="!pl-9 placeholder:text-slate-500"
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto">
            <option value="ALL">全部类目</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameZh}
              </option>
            ))}
          </select>
          <select value={market} onChange={(e) => setMarket(e.target.value)} className="!w-auto">
            <option value="ALL">全部国家</option>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.flag} {m.nameZh}
              </option>
            ))}
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="!w-auto">
            <option value="ALL">全部物流</option>
            <option value="express">国际快递</option>
            <option value="air">空运专线</option>
            <option value="sea_lcl">海运散货</option>
            <option value="sea_fcl">海运整柜</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!w-auto">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 类目快捷 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("ALL")}
            className={`rounded-full px-3 py-1.5 text-xs ${
              category === "ALL" ? "bg-amber-400 font-bold text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(category === c.slug ? "ALL" : c.slug)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                category === c.slug ? "bg-amber-400 font-bold text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.nameZh}
            </button>
          ))}
        </div>
      </div>

      {/* 统计条 */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "当前机会数", v: `${filtered.length}`, s: "条跨国差价组合" },
          { k: "平均净利率", v: pct(stats.avgMargin, 0), s: "全链路成本后" },
          { k: "S级机会", v: `${stats.sCount}`, s: "强推跟进" },
          { k: "最高单件净利", v: `¥${cny(stats.topProfit).toFixed(0)}`, s: "一件的利润" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
            <p className="text-xs text-slate-400">{s.k}</p>
            <p className="num mt-1 text-2xl font-extrabold text-amber-300">{s.v}</p>
            <p className="text-xs text-slate-500">{s.s}</p>
          </div>
        ))}
      </div>

      {/* 榜单 */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
        <div className="hidden grid-cols-12 gap-2 bg-[#0c1530] px-4 py-3 text-xs font-bold text-slate-400 md:grid">
          <div className="col-span-3">产品（中国采购 → 海外售）</div>
          <div className="col-span-2">目标市场</div>
          <div className="col-span-2">差价 / 净利</div>
          <div className="col-span-2">需求 · 趋势</div>
          <div className="col-span-2">税费 · 物流</div>
          <div className="col-span-1 text-right">评级</div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#0a1226] p-10 text-center text-sm text-slate-400">
            没有符合条件的机会，换个筛选试试。
          </div>
        ) : null}

        {filtered.map((o) => {
          const sellCny = cny(o.result.sellUsd);
          const diffRate = ((sellCny - o.sourcePriceCny) / Math.max(o.sourcePriceCny, 0.01)) * 100;
          const net = cny(o.result.netProfitUsd);
          return (
            <div
              key={`${o.productId}-${o.marketCode}-${o.platform}-${o.shippingMethod}`}
              onClick={() => setDetail(o)}
              className="card-glow grid-cols-12 gap-2 border-t border-slate-800 bg-[#0a1226] px-4 py-3 transition hover:bg-[#0e1836] md:grid md:items-center"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetail(o);
                }
              }}
            >
              <div className="col-span-3">
                <p className="truncate text-sm font-bold text-slate-100">{o.nameZh}</p>
                <p className="truncate text-xs text-slate-500">
                  {o.sku} · {o.supplierPlatform}
                </p>
                <p className="num mt-1 text-xs text-slate-400">
                  ¥{o.sourcePriceCny.toFixed(0)} <ArrowRight size={11} className="inline" />{" "}
                  <span className="text-slate-200">¥{sellCny.toFixed(0)}</span>{" "}
                  <span className="text-rose-300">+{diffRate.toFixed(0)}%</span>
                </p>
                {/* 点链接不应触发行的详情抽屉 */}
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <PlatformLinks compact links={sourcingLinks(o.nameZh)} />
                </div>
              </div>

              <div className="col-span-2 mt-2 md:mt-0">
                <p className="text-sm font-bold">
                  {o.flag} {o.marketName}
                </p>
                <p className="text-xs text-slate-500">{o.platform}</p>
                <p className="num text-xs text-sky-300">
                  {o.currency} {o.sellPriceLocal}
                </p>
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <PlatformLinks compact links={sellingLinks(o.marketCode, o.nameEn || o.nameZh)} />
                </div>
              </div>

              <div className="col-span-2 mt-2 md:mt-0">
                <p className={`num text-lg font-extrabold ${net >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                  ¥{net.toFixed(1)}
                  <span className="text-xs font-normal text-slate-400">/件</span>
                </p>
                <p className="num text-xs text-slate-400">
                  净利率 {pct(o.result.marginPct, 1)} · ROI {pct(o.result.roiPct, 0)}
                </p>
              </div>

              <div className="col-span-2 mt-2 md:mt-0">
                <div className="flex items-center gap-2">
                  <TrendGlyph trend={o.trend} demandScore={o.demandScore} />
                  <span className="num text-sm font-bold text-slate-200">{o.demandScore}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  月销≈{compact(o.monthlySales)} · 竞争 {o.competition}
                </p>
              </div>

              <div className="col-span-2 mt-2 md:mt-0">
                <p className="num text-xs text-slate-300">
                  关税{(o.dutyRate * 100).toFixed(1)}% · VAT{(o.vatRate * 100).toFixed(0)}%
                </p>
                <p className="num text-xs text-slate-500">
                  {o.shippingLabel} ¥{cny(o.result.freightUsd).toFixed(1)}
                </p>
                <p className="num text-xs text-slate-500">
                  {o.weightKg}kg · HS{o.hsCode}
                </p>
              </div>

              <div className="col-span-1 mt-2 text-left md:mt-0 md:text-right">
                <GradeBadge score={o.score} />
              </div>
            </div>
          );
        })}
      </div>

      {detail ? <DetailDrawer o={detail} cnyPerUsd={cnyPerUsd} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

function DetailDrawer({
  o,
  cnyPerUsd,
  onClose,
}: {
  o: Opportunity;
  cnyPerUsd: number;
  onClose: () => void;
}) {
  // Esc 关闭 + 打开期间锁定背景滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const cny = (usd: number) => usd * cnyPerUsd;
  const sellUsd = o.result.sellUsd;
  const palette = ["#38bdf8", "#818cf8", "#f472b6", "#fb923c", "#fbbf24", "#a3e635", "#2dd4bf", "#f87171"];
  const spend = o.result.lines.filter((l) => l.usd > 0);
  const grade = gradeOf(o.score);

  /*
   * 只在用户点击后渲染（detail 初值为 null），所以这里引用 document 不会在 SSR 阶段执行。
   *
   * 必须 portal 到 body：榜单根节点带 .animate-fadeup，动画 fill-mode 为 both，
   * 结束后元素仍保留 transform 的单位矩阵。transform 只要不是 none 就会成为
   * fixed 定位的包含块，弹层会被锚死在长列表内部而不是视口里。
   */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-slate-700 bg-[#0b1428] p-6 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold">{o.nameZh}</h3>
            <p className="text-xs text-slate-400">
              {o.nameEn} · {o.sku} · {o.categoryName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <Package size={12} /> 中国采购
            </p>
            <p className="num mt-1 text-xl font-extrabold text-sky-300">¥{o.sourcePriceCny.toFixed(1)}</p>
            <p className="text-xs text-slate-500">{o.supplierPlatform}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <TrendingUp size={12} /> 海外售价
            </p>
            <p className="num mt-1 text-xl font-extrabold text-amber-300">¥{cny(sellUsd).toFixed(1)}</p>
            <p className="text-xs text-slate-500">
              {o.marketName} · {o.platform} {o.currency} {o.sellPriceLocal}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <Flame size={12} /> 单件净利
            </p>
            <p className="num mt-1 text-xl font-extrabold text-emerald-300">
              ¥{cny(o.result.netProfitUsd).toFixed(1)}
            </p>
            <p className="text-xs text-slate-500">
              净利率 {pct(o.result.marginPct, 1)} · {grade.label}
            </p>
          </div>
        </div>

        <h4 className="mt-5 text-sm font-bold text-slate-200">💰 一件商品的钱都去哪了（按售价占比）</h4>
        <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-800">
          {spend.map((l, i) => (
            <div
              key={l.key}
              style={{ width: `${(l.usd / Math.max(sellUsd, 0.01)) * 100}%`, background: palette[i % palette.length] }}
              title={`${l.label} ¥${cny(l.usd).toFixed(2)}`}
            />
          ))}
          <div
            style={{
              width: `${(Math.max(o.result.netProfitUsd, 0) / Math.max(sellUsd, 0.01)) * 100}%`,
              background: "#34d399",
            }}
            title={`净利 ¥${cny(o.result.netProfitUsd).toFixed(2)}`}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-4">
          {spend.map((l, i) => (
            <div key={l.key} className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: palette[i % palette.length] }} />
              <span className="num truncate">
                {l.label} ¥{cny(l.usd).toFixed(1)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-emerald-300">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-400" />
            <span className="num truncate">净利 ¥{cny(o.result.netProfitUsd).toFixed(1)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
            <p className="text-xs font-bold text-slate-300">📊 需求面</p>
            <div className="mt-2 flex items-center gap-3">
              <TrendGlyph trend={o.trend} demandScore={o.demandScore} />
              <span className="text-xs text-slate-400">需求分 {o.demandScore} · 趋势 {o.trend}</span>
            </div>
            <p className="num mt-2 text-xs leading-6 text-slate-400">
              预估月销 {o.monthlySales} 件 · 竞争强度 {o.competition}
              <br />
              综合分 {o.score}（已计入利润、需求、竞争、时效与 IP 风险）
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
            <p className="text-xs font-bold text-slate-300">
              <Ship size={12} className="mr-1 inline" />
              合规与物流
            </p>
            <p className="num mt-2 text-xs leading-6 text-slate-400">
              HS {o.hsCode} · 关税 {(o.dutyRate * 100).toFixed(1)}% · VAT {(o.vatRate * 100).toFixed(0)}%
              <br />
              重量 {o.weightKg}kg · 落地成本 ¥{cny(o.result.landedUsd).toFixed(1)}
              <br />
              推荐物流：{o.shippingLabel}（¥{cny(o.result.freightUsd).toFixed(1)}，{o.daysMin}-{o.daysMax} 天）
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-400/10 p-3 text-xs leading-6 text-amber-100">
          🤖 结论：{o.result.verdictLabel}
          <br />
          按拿下该款 3% 月销份额估算，月度利润潜力约{" "}
          <b className="num">
            ¥
            {(cny(o.result.netProfitUsd) * o.monthlySales * 0.03).toLocaleString("zh-CN", {
              maximumFractionDigits: 0,
            })}
          </b>
          。这是模型推算，不含备货资金占用与滞销风险。
        </div>

        <div className="mt-4">
          <LivePrice
            market={o.marketCode}
            marketName={o.marketName}
            keyword={o.nameEn || o.nameZh}
            baselineLocal={o.sellPriceLocal}
            currency={o.currency}
          />
        </div>

        <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-[#0e1836] p-3">
          <PlatformLinks title="🇨🇳 去采购端核价" links={sourcingLinks(o.nameZh)} />
          <PlatformLinks
            title={`${o.flag} 去 ${o.marketName} 销售端比价`}
            links={sellingLinks(o.marketCode, o.nameEn || o.nameZh)}
          />
          <p className="text-[11px] leading-5 text-slate-500">
            以上为按品名生成的搜索链接，落地页是多个商品。本页数字来自模型基准值，
            不是这些链接里某个具体商品的实时价——请以打开后的实际报价复核。
          </p>
        </div>

        <Link
          href={`/calculator?sku=${o.sku}&market=${o.marketCode}&method=${o.shippingMethod}`}
          className="mt-4 block w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-center text-sm font-extrabold text-slate-900 hover:brightness-110"
        >
          把这条机会送入「全成本测算器」深度验证 →
        </Link>
      </div>
    </div>,
    document.body,
  );
}
