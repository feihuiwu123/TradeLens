"use client";

import { useState } from "react";
import { ExternalLink, Gauge, TriangleAlert } from "lucide-react";

type Row = {
  sku: string;
  nameZh: string;
  market: string;
  marketName: string;
  currency: string;
  baselineLocal: number;
  actualLocal?: number;
  deviationPct?: number;
  range?: { min: number; max: number };
  mixed?: boolean;
  sampleCount?: number;
  baselineMarginPct?: number;
  actualMarginPct?: number;
  marginDeltaPct?: number;
  baselineNetCny?: number;
  actualNetCny?: number;
  verdictFlipped?: boolean;
  baselineVerdict?: string;
  actualVerdict?: string;
  cached?: boolean;
  topListings?: { title: string; price: number; url: string }[];
  error?: string | null;
};

type Result = {
  checked: number;
  succeeded: number;
  summary: {
    avgAbsDeviationPct: number;
    overstated: number;
    understated: number;
    withinFivePct: number;
    verdictFlips: number;
  } | null;
  rows: Row[];
};

const VERDICT_ZH: Record<string, string> = { go: "可做", thin: "薄利", no: "不做" };

export function CalibrationBoard({ markets }: { markets: { code: string; nameZh: string }[] }) {
  const [limit, setLimit] = useState("6");
  const [market, setMarket] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    setData(null);
    try {
      const sp = new URLSearchParams({ limit });
      if (market) sp.set("market", market);
      const res = await fetch(`/api/calibrate?${sp}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "请求失败");
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fadeup">
      <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
          <Gauge size={15} /> 基准值校准
        </p>
        <p className="mt-2 text-[11px] leading-6 text-slate-400">
          榜单里的海外售价是<b className="text-slate-200">模型基准值</b>，不是实时行情。
          这里逐条抓取该市场的真实在售价，按实测价重算全成本利润，量化基准值失真造成的影响。
          冷抓每条约 5~7 秒，命中快照秒回。
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">
            校准条数
            <select value={limit} onChange={(e) => setLimit(e.target.value)} className="mt-1 !w-auto">
              {["3", "6", "10", "15"].map((n) => (
                <option key={n} value={n}>
                  前 {n} 条
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            限定市场
            <select value={market} onChange={(e) => setMarket(e.target.value)} className="mt-1 !w-auto">
              <option value="">不限</option>
              {markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.nameZh}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="mt-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-2.5 text-sm font-extrabold text-slate-900 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? `正在抓取并重算，约需 ${Math.ceil((Number(limit) / 3) * 7)} 秒…` : "开始校准"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>
        ) : null}
      </div>

      {data?.summary ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { k: "平均偏离", v: `${data.summary.avgAbsDeviationPct}%`, s: "基准值与实测价的绝对差" },
              { k: "高估条数", v: `${data.summary.overstated}`, s: "基准价高于实测 5% 以上" },
              { k: "低估条数", v: `${data.summary.understated}`, s: "基准价低于实测 5% 以上" },
              { k: "结论翻转", v: `${data.summary.verdictFlips}`, s: "基准判可做、实测不可做" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
                <p className="text-xs text-slate-400">{s.k}</p>
                <p className="num mt-1 text-2xl font-extrabold text-amber-300">{s.v}</p>
                <p className="text-xs text-slate-500">{s.s}</p>
              </div>
            ))}
          </div>

          {data.summary.verdictFlips > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-400/10 p-4 text-xs leading-6 text-rose-200">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                <b>有 {data.summary.verdictFlips} 条机会的结论被推翻。</b>
                <br />
                这些在榜单上显示为「可做」，但按实测售价重算后并不成立——照榜单备货会亏。
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      {data && data.rows.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
          <div className="hidden grid-cols-12 gap-2 bg-[#0c1530] px-4 py-3 text-xs font-bold text-slate-400 md:grid">
            <div className="col-span-3">产品 · 市场</div>
            <div className="col-span-2">基准价 → 实测价</div>
            <div className="col-span-2">偏离</div>
            <div className="col-span-2">净利率变化</div>
            <div className="col-span-3">实测样本</div>
          </div>

          {data.rows.map((r) => (
            <div
              key={`${r.sku}-${r.market}`}
              className="grid-cols-12 gap-2 border-t border-slate-800 bg-[#0a1226] px-4 py-3 md:grid"
            >
              <div className="col-span-3">
                <p className="truncate text-sm font-bold text-slate-100">{r.nameZh}</p>
                <p className="truncate text-xs text-slate-500">
                  {r.sku} · {r.marketName}
                  {r.cached ? " · 快照" : ""}
                </p>
              </div>

              {r.error ? (
                <div className="col-span-9 mt-2 text-xs text-slate-400 md:mt-0">
                  <span className="rounded-lg bg-slate-800 px-2 py-1">未能校准：{r.error}</span>
                </div>
              ) : (
                <>
                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className="num text-sm">
                      <span className="text-slate-400">
                        {r.currency} {r.baselineLocal}
                      </span>
                      <span className="mx-1 text-slate-600">→</span>
                      <span className="font-bold text-sky-300">{r.actualLocal}</span>
                    </p>
                    <p className="num text-[11px] text-slate-500">
                      区间 {r.range?.min}–{r.range?.max} · {r.sampleCount} 件
                    </p>
                  </div>

                  <div className="col-span-2 mt-2 md:mt-0">
                    <p
                      className={`num text-lg font-extrabold ${
                        Math.abs(r.deviationPct ?? 0) <= 5
                          ? "text-slate-300"
                          : (r.deviationPct ?? 0) < 0
                            ? "text-rose-300"
                            : "text-emerald-300"
                      }`}
                    >
                      {(r.deviationPct ?? 0) > 0 ? "+" : ""}
                      {r.deviationPct}%
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {Math.abs(r.deviationPct ?? 0) <= 5
                        ? "基准值可用"
                        : (r.deviationPct ?? 0) < 0
                          ? "基准价高估"
                          : "基准价低估"}
                    </p>
                  </div>

                  <div className="col-span-2 mt-2 md:mt-0">
                    <p className="num text-sm">
                      <span className="text-slate-400">{r.baselineMarginPct}%</span>
                      <span className="mx-1 text-slate-600">→</span>
                      <span
                        className={`font-bold ${(r.actualMarginPct ?? 0) >= 25 ? "text-emerald-300" : (r.actualMarginPct ?? 0) >= 12 ? "text-amber-300" : "text-rose-300"}`}
                      >
                        {r.actualMarginPct}%
                      </span>
                    </p>
                    <p className="num text-[11px] text-slate-500">
                      净利 ¥{r.baselineNetCny} → ¥{r.actualNetCny}
                    </p>
                    {r.verdictFlipped ? (
                      <span className="mt-1 inline-block rounded bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                        {VERDICT_ZH[r.baselineVerdict ?? ""]} → {VERDICT_ZH[r.actualVerdict ?? ""]}
                      </span>
                    ) : null}
                  </div>

                  <div className="col-span-3 mt-2 md:mt-0">
                    {r.mixed ? (
                      <p className="mb-1 rounded bg-rose-400/10 px-1.5 py-0.5 text-[10px] text-rose-200">
                        样本混档，实测价仅供参考
                      </p>
                    ) : null}
                    <div className="space-y-0.5">
                      {r.topListings?.map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] transition hover:bg-[#0e1836]"
                        >
                          <span className="num w-12 shrink-0 text-sky-300">{l.price}</span>
                          <span className="flex-1 truncate text-slate-400">{l.title}</span>
                          <ExternalLink size={9} className="shrink-0 text-slate-600" />
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
