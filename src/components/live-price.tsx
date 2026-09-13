"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";

type Listing = {
  asin: string;
  title: string;
  price: number;
  rating: number | null;
  reviewCount: number | null;
  url: string;
};

type LiveResult = {
  currency?: string;
  source?: string;
  cached?: boolean;
  median?: number | null;
  range?: { min: number; max: number } | null;
  mixed?: boolean;
  listings: Listing[];
  error?: string;
};

/**
 * 按需拉取该市场的实时在售价。
 *
 * 榜单默认展示模型基准值——61 条组合全部实时抓会烧光配额且要等几分钟。
 * 用户对某一条感兴趣时点一下才抓，命中快照秒回。
 */
export function LivePrice({
  market,
  marketName,
  keyword,
  baselineLocal,
  currency,
}: {
  market: string;
  marketName: string;
  keyword: string;
  baselineLocal: number;
  currency: string;
}) {
  const [data, setData] = useState<LiveResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/live-price?market=${encodeURIComponent(market)}&keyword=${encodeURIComponent(keyword)}`,
      );
      setData(await res.json());
    } catch (e) {
      setData({ listings: [], error: e instanceof Error ? e.message : "网络异常" });
    } finally {
      setBusy(false);
    }
  }

  const delta =
    data?.median && baselineLocal > 0 ? ((data.median - baselineLocal) / baselineLocal) * 100 : null;

  return (
    <div className="rounded-xl border border-slate-700 bg-[#0e1836] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-300">
          {marketName} 实时在售价
          <span className="ml-1.5 font-normal text-slate-500">
            榜单上方数字为模型基准值，点此拉真实挂牌价
          </span>
        </p>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-300 hover:brightness-125 disabled:opacity-50"
        >
          <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
          {busy ? "抓取中，首次约需十几秒…" : data ? "重新拉取" : "拉取实时价"}
        </button>
      </div>

      {data?.error ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-400/10 px-2 py-1.5 text-[11px] leading-5 text-rose-200">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          {data.error}
        </p>
      ) : null}

      {data && data.listings.length > 0 ? (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
            <span className="num text-sm font-extrabold text-sky-300">
              {data.currency ?? currency} {data.median}
            </span>
            <span className="text-slate-500">
              区间 {data.range?.min}–{data.range?.max} · {data.listings.length} 件样本
            </span>
            {delta !== null ? (
              <span className={delta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                较基准值 {delta >= 0 ? "+" : ""}
                {delta.toFixed(0)}%
              </span>
            ) : null}
            <span className={data.cached ? "text-slate-500" : "text-emerald-400"}>{data.source}</span>
          </div>

          {data.mixed ? (
            <p className="mt-1.5 rounded-lg bg-rose-400/10 px-2 py-1 text-[11px] text-rose-200">
              样本横跨白牌与品牌，中位数不代表你的货能卖到的价 —— 请挑同档位商品对标
            </p>
          ) : null}

          <div className="mt-2 space-y-0.5">
            {data.listings.map((l) => (
              <a
                key={l.asin}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px] transition hover:bg-[#12204a]"
              >
                <span className="num w-14 shrink-0 font-bold text-sky-300">{l.price}</span>
                <span className="w-9 shrink-0 text-slate-500">{l.rating ? `★${l.rating}` : "—"}</span>
                <span className="flex-1 truncate text-slate-300">{l.title}</span>
                <ExternalLink size={10} className="shrink-0 text-slate-500" />
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
