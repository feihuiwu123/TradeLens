"use client";

import { useMemo, useState } from "react";
import { Verdict, Waterfall } from "@/components/ui";
import { calculateProfit, methodLabel } from "@/lib/profit";
import type { CalcResult, ShippingMethod } from "@/lib/types";
import { money, pct } from "@/lib/format";

type ProductOpt = {
  sku: string;
  nameZh: string;
  sourcePriceCny: number;
  weightKg: number;
  volumeCbm: number;
  hsCode: string;
  moq: number;
};

type MarketOpt = { code: string; nameZh: string; flag: string; currency: string; vatRate: number };

type ListingOpt = { sku: string; market: string; platform: string; sellPrice: number };

type ShipOpt = {
  market: string;
  method: ShippingMethod;
  methodZh: string;
  ratePerKgUsd: number;
  ratePerCbmUsd: number;
  minChargeUsd: number;
};

type TariffOpt = { hsCode: string; market: string; mfnDuty: number; extraDuty: number; vatRate: number };
type FeeOpt = { platform: string; market: string; referralRate: number; fulfillmentPerUnitUsd: number; paymentFeeRate: number };
type FxOpt = { currency: string; cnyPerUnit: number };

export function CalculatorForm({
  products,
  markets,
  listings,
  shipping,
  tariffs,
  fees,
  fx,
  initialSku,
  initialMarket,
}: {
  products: ProductOpt[];
  markets: MarketOpt[];
  listings: ListingOpt[];
  shipping: ShipOpt[];
  tariffs: TariffOpt[];
  fees: FeeOpt[];
  fx: FxOpt[];
  initialSku?: string;
  initialMarket?: string;
}) {
  const [sku, setSku] = useState(initialSku && products.some((p) => p.sku === initialSku) ? initialSku : products[0]?.sku ?? "");
  const [market, setMarket] = useState(
    initialMarket && markets.some((m) => m.code === initialMarket) ? initialMarket : listings.find((l) => l.sku === sku)?.market ?? markets[0]?.code ?? "US",
  );
  const [method, setMethod] = useState<ShippingMethod>("express");
  const product = products.find((p) => p.sku === sku) ?? products[0];
  const listing = listings.find((l) => l.sku === sku && l.market === market) ?? listings.find((l) => l.sku === sku);
  const [source, setSource] = useState(product?.sourcePriceCny ?? 20);
  const [sell, setSell] = useState(listing?.sellPrice ?? 19.99);
  const [qty, setQty] = useState(product?.moq ?? 50);
  const [ads, setAds] = useState(8);
  const [returns, setReturns] = useState(6);
  const [weight, setWeight] = useState(product?.weightKg ?? 0.2);
  const [cbm, setCbm] = useState(product?.volumeCbm ?? 0.001);
  const [saved, setSaved] = useState("");

  function applyProduct(nextSku: string) {
    const p = products.find((x) => x.sku === nextSku);
    const l = listings.find((x) => x.sku === nextSku && x.market === market) ?? listings.find((x) => x.sku === nextSku);
    setSku(nextSku);
    if (p) {
      setSource(p.sourcePriceCny);
      setWeight(p.weightKg);
      setCbm(p.volumeCbm);
      setQty(p.moq);
    }
    if (l) {
      setMarket(l.market);
      setSell(l.sellPrice);
    }
  }

  const result: CalcResult | null = useMemo(() => {
    if (!product) return null;
    const mkt = markets.find((m) => m.code === market);
    if (!mkt) return null;
    const ship = shipping.find((s) => s.market === market && s.method === method);
    if (!ship) return null;
    const tariff = tariffs.find((t) => t.hsCode === product.hsCode && t.market === market);
    const plat = listing?.platform ?? "Amazon";
    const fee = fees.find((f) => f.platform === plat && f.market === market) ?? fees.find((f) => f.platform === plat);
    const cnyUsd = fx.find((f) => f.currency === "USD")?.cnyPerUnit ?? 7.25;
    const cnyLocal = fx.find((f) => f.currency === mkt.currency)?.cnyPerUnit ?? cnyUsd;
    return calculateProfit({
      sourcePriceCny: source,
      quantity: qty,
      weightKg: weight,
      volumeCbm: cbm,
      sellPriceLocal: sell,
      sellCurrency: mkt.currency,
      cnyPerSellCurrency: cnyLocal,
      cnyPerUsd: cnyUsd,
      shippingMethod: method,
      ratePerKgUsd: ship.ratePerKgUsd,
      ratePerCbmUsd: ship.ratePerCbmUsd,
      minChargeUsd: ship.minChargeUsd,
      dutyRate: (tariff?.mfnDuty ?? 0) + (tariff?.extraDuty ?? 0),
      vatRate: tariff?.vatRate ?? mkt.vatRate,
      vatRecoverable: plat !== "Shopify" && mkt.vatRate > 0 ? true : mkt.vatRate === 0,
      platformReferralRate: fee?.referralRate ?? 0.15,
      fulfillmentPerUnitUsd: fee?.fulfillmentPerUnitUsd ?? 3,
      paymentFeeRate: fee?.paymentFeeRate ?? 0.02,
      adsRate: ads / 100,
      returnRate: returns / 100,
      insuranceRate: 0.004,
      packingPerUnitUsd: 0.18,
      inspectionPerOrderUsd: 40,
    });
  }, [product, market, method, source, sell, qty, ads, returns, weight, cbm, markets, shipping, tariffs, fees, fx, listing]);

  async function save() {
    if (!result || !product) return;
    const res = await fetch("/api/calculator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        save: true,
        title: `${product.nameZh} → ${market} / ${methodLabel(method)}`,
        sku,
        market,
        shippingMethod: method,
        sourcePriceCny: source,
        sellPriceLocal: sell,
        quantity: qty,
        adsRate: ads / 100,
        returnRate: returns / 100,
      }),
    });
    if (res.ok) setSaved("已写入利润档案，可在观察页查看。");
  }

  if (!product || !result) return <p>数据不足。</p>;
  const mkt = markets.find((m) => m.code === market);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form className="panel space-y-4 rounded-[2rem] p-6" onSubmit={(e) => e.preventDefault()}>
        <label className="block text-sm">
          货源产品
          <select className="mt-1" value={sku} onChange={(e) => applyProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.nameZh} · ¥{p.sourcePriceCny}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            目标市场
            <select
              className="mt-1"
              value={market}
              onChange={(e) => {
                const code = e.target.value;
                setMarket(code);
                const l = listings.find((x) => x.sku === sku && x.market === code);
                if (l) setSell(l.sellPrice);
              }}
            >
              {markets.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.flag} {m.nameZh}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            物流
            <select className="mt-1" value={method} onChange={(e) => setMethod(e.target.value as ShippingMethod)}>
              <option value="express">国际快递</option>
              <option value="air">空运专线</option>
              <option value="sea_lcl">海运散货</option>
              <option value="sea_fcl">海运整柜</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Num label="货源价 CNY" value={source} onChange={setSource} />
          <Num label={`售价 ${mkt?.currency ?? ""}`} value={sell} onChange={setSell} />
          <Num label="件数" value={qty} onChange={setQty} />
          <Num label="重量 kg" value={weight} onChange={setWeight} />
          <Num label="体积 cbm" value={cbm} onChange={setCbm} />
          <Num label="广告 %" value={ads} onChange={setAds} />
          <Num label="退货率 %" value={returns} onChange={setReturns} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          HS {product.hsCode} · 平台 {listing?.platform ?? "Amazon"} · 关税按税则表自动带出，可改售价做敏感度。
        </p>
        <button type="button" onClick={save} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm text-[#071018]">
          保存这次测算
        </button>
        {saved ? <p className="text-sm text-[var(--teal)]">{saved}</p> : null}
      </form>

      <div className="panel rounded-[2rem] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-[var(--gold)]">PROFIT WATERFALL</p>
            <h2 className="font-serif mt-2 text-3xl">{product.nameZh}</h2>
            <p className="text-sm text-[var(--muted)]">
              {mkt?.flag} {mkt?.nameZh} · {methodLabel(method)}
            </p>
          </div>
          <Verdict verdict={result.verdict} />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">{result.verdictLabel}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi k="单件净利" v={money(result.netProfitUsd)} />
          <Kpi k="本单净利" v={money(result.netProfitOrderUsd)} />
          <Kpi k="利润率" v={pct(result.marginPct)} />
          <Kpi k="ROI" v={pct(result.roiPct)} />
        </div>
        <div className="mt-6">
          <Waterfall lines={result.lines} landed={result.landedUsd} sell={result.sellUsd} net={result.netProfitUsd} />
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="text-sm">
      {label}
      <input
        className="mt-1"
        type="number"
        step="any"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <p className="text-xs text-[var(--muted)]">{k}</p>
      <p className="font-serif num mt-1 text-xl text-[var(--gold-2)]">{v}</p>
    </div>
  );
}
