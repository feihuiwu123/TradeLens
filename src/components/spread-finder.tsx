"use client";

import { useState } from "react";
import { Plus, Search, Trash2, TriangleAlert } from "lucide-react";

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
};

type Report = {
  count: number;
  best: { market: string; netProfitCny: number; grade: string } | null;
  rows: Row[];
  skipped: { marketCode: string; reason: string }[];
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

export function SpreadFinder({ markets }: { markets: { code: string; nameZh: string; flag: string }[] }) {
  const [nameZh, setNameZh] = useState("私模半入耳蓝牙耳机");
  const [sourcePriceCny, setSourcePriceCny] = useState("28.5");
  const [weightKg, setWeightKg] = useState("0.085");
  const [volumeCbm, setVolumeCbm] = useState("0.0004");
  const [hsCode, setHsCode] = useState("8518.30");
  const [quotes, setQuotes] = useState(DEFAULT_QUOTES);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const body = {
        probe: {
          nameZh,
          sourcePriceCny: Number(sourcePriceCny),
          weightKg: Number(weightKg),
          volumeCbm: Number(volumeCbm),
          hsCode: hsCode.trim(),
        },
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
      <div className="rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
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

        <p className="mt-5 flex items-center gap-2 text-sm font-extrabold text-amber-200">
          各国在售价
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-normal text-slate-400">
            自己填最准 · 零外部调用
          </span>
        </p>
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
              <input
                value={q.sellPrice}
                onChange={(e) => setQuotes(quotes.map((x, j) => (j === i ? { ...x, sellPrice: e.target.value } : x)))}
                placeholder="当地币种售价，如 19.99"
                inputMode="decimal"
              />
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
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-sm font-extrabold text-slate-900 hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "正在按全链路成本重算…" : "发现价差 →"}
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
                  </div>
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
