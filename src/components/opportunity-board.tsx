"use client";

import { useMemo, useState } from "react";
import { OpportunityCard } from "@/components/ui";
import type { Opportunity, ShippingMethod } from "@/lib/types";
import { pct } from "@/lib/format";

export function OpportunityBoard({
  items,
  markets,
  categories,
}: {
  items: Opportunity[];
  markets: { code: string; nameZh: string; flag: string }[];
  categories: { slug: string; nameZh: string }[];
}) {
  const [market, setMarket] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [minMargin, setMinMargin] = useState(0);
  const [onlyGo, setOnlyGo] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((o) => {
      if (market !== "ALL" && o.marketCode !== market) return false;
      if (category !== "ALL" && o.categorySlug !== category) return false;
      if (method !== "ALL" && o.shippingMethod !== (method as ShippingMethod)) return false;
      if (o.result.marginPct < minMargin) return false;
      if (onlyGo && o.result.verdict !== "go") return false;
      return true;
    });
  }, [items, market, category, method, minMargin, onlyGo]);

  const avg = filtered.reduce((s, o) => s + o.result.marginPct, 0) / Math.max(filtered.length, 1);

  return (
    <div>
      <div className="panel mb-8 grid gap-3 rounded-3xl p-5 md:grid-cols-5">
        <select value={market} onChange={(e) => setMarket(e.target.value)}>
          <option value="ALL">全部市场</option>
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {m.flag} {m.nameZh}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">全部类目</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameZh}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="ALL">默认物流</option>
          <option value="express">国际快递</option>
          <option value="air">空运专线</option>
          <option value="sea_lcl">海运散货</option>
          <option value="sea_fcl">海运整柜</option>
        </select>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          最低利润率 {minMargin}%
          <input type="range" min={0} max={40} value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyGo} onChange={(e) => setOnlyGo(e.target.checked)} className="w-auto" />
          只看可做
        </label>
      </div>
      <p className="mb-5 text-sm text-[var(--muted)]">
        {filtered.length} 条机会 · 平均利润率 {pct(avg)} · 分数已综合利润、需求、竞争、时效与 IP 风险
      </p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o) => (
          <OpportunityCard key={`${o.productId}-${o.marketCode}-${o.platform}-${o.shippingMethod}`} o={o} />
        ))}
      </div>
    </div>
  );
}
