import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { compact, money, pct } from "@/lib/format";

export function Badge({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "teal" | "ok" | "warn" | "no" | "mute";
}) {
  const map = {
    gold: "border-[var(--gold)] text-[var(--gold)]",
    teal: "border-[var(--teal)] text-[var(--teal)]",
    ok: "border-emerald-400 text-emerald-300",
    warn: "border-amber-400 text-amber-200",
    no: "border-rose-400 text-rose-300",
    mute: "border-white/15 text-[var(--muted)]",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs tracking-wide ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Verdict({ verdict }: { verdict: "go" | "thin" | "no" }) {
  const label = verdict === "go" ? "可做" : verdict === "thin" ? "薄利" : "不做";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold verdict-${verdict}`}>{label}</span>;
}

export function SectionTitle({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="text-[10px] font-bold tracking-[0.28em] text-amber-300">{kicker}</p>
      <h2 className="mt-2 text-2xl font-black md:text-3xl">{title}</h2>
      {desc ? <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p> : null}
    </div>
  );
}

/** 页头：图标方块 + 中文标题 + 英文代号 + 一句话说明，对齐各页视觉节奏。 */
export function PageHead({
  icon: Icon,
  zh,
  en,
  desc,
}: {
  icon: LucideIcon;
  zh: string;
  en: string;
  desc: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800">
        <Icon size={17} className="text-amber-300" />
      </span>
      <div>
        <p className="text-sm font-extrabold text-slate-100">
          {zh} <span className="ml-1 text-[10px] font-normal tracking-widest text-slate-500">{en}</span>
        </p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

export function OpportunityCard({ o }: { o: Opportunity }) {
  return (
    <Link href={`/products/${o.productId}?market=${o.marketCode}`} className="panel group overflow-hidden rounded-3xl">
      <div className="relative h-44 overflow-hidden">
        <img src={o.imageUrl} alt={o.nameZh} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge>{o.flag} {o.marketName}</Badge>
          <Verdict verdict={o.result.verdict} />
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">{o.categoryName} · {o.sku}</p>
            <h3 className="font-serif text-xl">{o.nameZh}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">综合分</p>
            <p className="num text-2xl text-[var(--gold)]">{o.score}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-[var(--muted)]">货源</p>
            <p className="num">¥{o.sourcePriceCny.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">售价</p>
            <p className="num">{o.currency} {o.sellPriceLocal}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">净利</p>
            <p className="num text-[var(--teal)]">{money(o.result.netProfitUsd)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span>利润率 {pct(o.result.marginPct)}</span>
          <span>ROI {pct(o.result.roiPct)}</span>
          <span>月销 {compact(o.monthlySales)}</span>
          <span>{o.shippingLabel} {o.daysMin}-{o.daysMax}天</span>
        </div>
      </div>
    </Link>
  );
}

export function Waterfall({ lines, landed, sell, net }: {
  lines: { key: string; label: string; usd: number; note?: string }[];
  landed: number;
  sell: number;
  net: number;
}) {
  const max = Math.max(sell, ...lines.map((l) => Math.abs(l.usd)), 1);
  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <div key={line.key} className="grid grid-cols-[1fr_90px] items-center gap-3 text-sm">
          <div>
            <div className="flex justify-between">
              <span>{line.label}</span>
              {line.note ? <span className="text-[var(--muted)]">{line.note}</span> : null}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--teal)]"
                style={{ width: `${Math.min(100, (Math.abs(line.usd) / max) * 100)}%` }}
              />
            </div>
          </div>
          <p className="num text-right">{money(line.usd)}</p>
        </div>
      ))}
      <div className="gold-line my-3" />
      <div className="flex justify-between text-sm"><span>落地成本</span><span className="num">{money(landed)}</span></div>
      <div className="flex justify-between text-sm"><span>含税售价（美元）</span><span className="num">{money(sell)}</span></div>
      <div className="flex justify-between font-serif text-lg"><span>单件净利润</span><span className="num text-[var(--gold)]">{money(net)}</span></div>
    </div>
  );
}
