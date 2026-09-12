"use client";

import { useMemo, useState } from "react";
import { freightPerUnitUsd, methodLabel } from "@/lib/profit";
import type { ShippingMethod } from "@/lib/types";
import { money } from "@/lib/format";

type Rate = {
  market: string;
  method: ShippingMethod;
  methodZh: string;
  ratePerKgUsd: number;
  ratePerCbmUsd: number;
  minChargeUsd: number;
  daysMin: number;
  daysMax: number;
  notes: string;
};

export function ShippingBoard({
  markets,
  rates,
}: {
  markets: { code: string; nameZh: string; flag: string }[];
  rates: Rate[];
}) {
  const [market, setMarket] = useState("US");
  const [weight, setWeight] = useState(0.3);
  const [cbm, setCbm] = useState(0.0015);
  const [qty, setQty] = useState(100);

  const rows = useMemo(() => {
    return rates
      .filter((r) => r.market === market)
      .map((r) => {
        const per = freightPerUnitUsd({
          quantity: qty,
          weightKg: weight,
          volumeCbm: cbm,
          shippingMethod: r.method,
          ratePerKgUsd: r.ratePerKgUsd,
          ratePerCbmUsd: r.ratePerCbmUsd,
          minChargeUsd: r.minChargeUsd,
        });
        return { ...r, per, order: per * qty };
      });
  }, [rates, market, weight, cbm, qty]);

  const max = Math.max(...rows.map((r) => r.per), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form className="panel space-y-4 rounded-[2rem] p-6" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm">
          目的国
          <select className="mt-1" value={market} onChange={(e) => setMarket(e.target.value)}>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.flag} {m.nameZh}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          单件重量 kg
          <input className="mt-1" type="number" step="any" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          单件体积 cbm
          <input className="mt-1" type="number" step="any" value={cbm} onChange={(e) => setCbm(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          件数
          <input className="mt-1" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </label>
        <p className="text-xs text-[var(--muted)]">空运/快递按实际重与体积重（cbm×167）取大；海运按体积，并受最低收费约束。</p>
      </form>
      <div className="space-y-4">
        {rows.map((r) => (
          <article key={r.method} className="panel rounded-3xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-2xl">{methodLabel(r.method)}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {r.daysMin}-{r.daysMax} 天 · {r.notes}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-xl text-[var(--gold)]">{money(r.per)}/件</p>
                <p className="text-xs text-[var(--muted)]">本单 {money(r.order)}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--teal)]"
                style={{ width: `${(r.per / max) * 100}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
