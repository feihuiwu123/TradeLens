import type { CalcInput, CalcResult, CostLine, Opportunity, ShippingMethod } from "@/lib/types";

export function usdFromCny(cny: number, cnyPerUsd: number) {
  if (cnyPerUsd <= 0) return 0;
  return cny / cnyPerUsd;
}

export function usdFromLocal(local: number, cnyPerLocal: number, cnyPerUsd: number) {
  if (cnyPerUsd <= 0) return 0;
  return (local * cnyPerLocal) / cnyPerUsd;
}

export function volumetricKg(volumeCbm: number) {
  return volumeCbm * 167;
}

export function chargeableWeightKg(weightKg: number, volumeCbm: number, method: ShippingMethod) {
  if (method === "sea_lcl" || method === "sea_fcl") return weightKg;
  return Math.max(weightKg, volumetricKg(volumeCbm));
}

export function freightPerUnitUsd(input: Pick<
  CalcInput,
  "quantity" | "weightKg" | "volumeCbm" | "shippingMethod" | "ratePerKgUsd" | "ratePerCbmUsd" | "minChargeUsd"
>) {
  const qty = Math.max(1, input.quantity);
  if (input.shippingMethod === "sea_lcl" || input.shippingMethod === "sea_fcl") {
    const raw = input.volumeCbm * input.ratePerCbmUsd;
    return Math.max(input.minChargeUsd / qty, raw);
  }
  const kg = chargeableWeightKg(input.weightKg, input.volumeCbm, input.shippingMethod);
  const raw = kg * input.ratePerKgUsd;
  return Math.max(input.minChargeUsd / qty, raw);
}

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function calculateProfit(input: CalcInput): CalcResult {
  const qty = Math.max(1, Math.round(input.quantity));
  const goodsUsd = usdFromCny(input.sourcePriceCny, input.cnyPerUsd);
  const packingUsd = input.packingPerUnitUsd;
  const inspectionUsd = input.inspectionPerOrderUsd / qty;
  const freightUsd = freightPerUnitUsd({ ...input, quantity: qty });
  const insuranceUsd = goodsUsd * input.insuranceRate;
  const cifUsd = goodsUsd + freightUsd + insuranceUsd;
  const dutyUsd = cifUsd * input.dutyRate;
  const vatUsd = (cifUsd + dutyUsd) * input.vatRate;
  const vatAsCostUsd = input.vatRecoverable ? 0 : vatUsd;
  const landedUsd = goodsUsd + packingUsd + inspectionUsd + freightUsd + insuranceUsd + dutyUsd + vatAsCostUsd;
  const sellUsd = usdFromLocal(input.sellPriceLocal, input.cnyPerSellCurrency, input.cnyPerUsd);
  const referralUsd = sellUsd * input.platformReferralRate;
  const paymentUsd = sellUsd * input.paymentFeeRate;
  const fulfillmentUsd = input.fulfillmentPerUnitUsd;
  const adsUsd = sellUsd * input.adsRate;
  const returnsUsd = sellUsd * input.returnRate * 0.55;
  const totalFeesUsd = referralUsd + paymentUsd + fulfillmentUsd + adsUsd + returnsUsd;
  const netProfitUsd = sellUsd - landedUsd - totalFeesUsd;
  const netProfitOrderUsd = netProfitUsd * qty;
  const revenueUsd = sellUsd;
  const marginPct = sellUsd > 0 ? (netProfitUsd / sellUsd) * 100 : 0;
  const roiPct = landedUsd > 0 ? (netProfitUsd / landedUsd) * 100 : 0;

  const lines: CostLine[] = [
    { key: "goods", label: "中国货源采购", usd: goodsUsd, note: `¥${input.sourcePriceCny.toFixed(2)}` },
    { key: "packing", label: "包装 / 辅材", usd: packingUsd },
    { key: "inspection", label: "验货摊销", usd: inspectionUsd },
    { key: "freight", label: "国际运费", usd: freightUsd },
    { key: "insurance", label: "运输保险", usd: insuranceUsd },
    { key: "duty", label: "关税 + 附加税", usd: dutyUsd, note: `${(input.dutyRate * 100).toFixed(1)}%` },
    {
      key: "vat",
      label: input.vatRecoverable ? "增值税（可抵扣，不计成本）" : "增值税 / GST",
      usd: vatAsCostUsd,
      note: `${(input.vatRate * 100).toFixed(1)}%`,
    },
    { key: "referral", label: "平台佣金", usd: referralUsd },
    { key: "fulfillment", label: "履约 / FBA / 尾程", usd: fulfillmentUsd },
    { key: "payment", label: "支付手续费", usd: paymentUsd },
    { key: "ads", label: "广告投放预留", usd: adsUsd },
    { key: "returns", label: "退货损耗预留", usd: returnsUsd },
  ];

  let verdict: CalcResult["verdict"] = "no";
  let verdictLabel = "不建议：全成本后几乎没有利润";
  if (marginPct >= 25 && netProfitUsd >= 3) {
    verdict = "go";
    verdictLabel = "可做：差价覆盖运费、关税与平台费用后仍有安全垫";
  } else if (marginPct >= 12 && netProfitUsd >= 1.2) {
    verdict = "thin";
    verdictLabel = "薄利：可测款，但广告或退货稍高就会亏";
  }

  return {
    quantity: qty,
    goodsUsd,
    freightUsd,
    insuranceUsd,
    packingUsd,
    inspectionUsd,
    cifUsd,
    dutyUsd,
    vatUsd,
    vatAsCostUsd,
    landedUsd,
    sellUsd,
    referralUsd,
    paymentUsd,
    fulfillmentUsd,
    adsUsd,
    returnsUsd,
    totalFeesUsd,
    netProfitUsd,
    netProfitOrderUsd,
    marginPct,
    roiPct,
    revenueUsd,
    chargeableKg: chargeableWeightKg(input.weightKg, input.volumeCbm, input.shippingMethod),
    lines,
    verdict,
    verdictLabel,
  };
}

export function opportunityScore(opts: {
  marginPct: number;
  roiPct: number;
  demandScore: number;
  monthlySales: number;
  competition: number;
  logisticsScore: number;
  daysMax: number;
  ipRisk: string;
}) {
  const margin = clamp(opts.marginPct / 40);
  const roi = clamp(opts.roiPct / 120);
  const demand = clamp((opts.demandScore + Math.min(opts.monthlySales / 40, 100)) / 200);
  const competition = 1 - clamp(opts.competition / 100);
  const speed = clamp(1 - (opts.daysMax - 5) / 45);
  const logistics = clamp(opts.logisticsScore / 100);
  const ipPenalty = opts.ipRisk === "high" ? 0.72 : opts.ipRisk === "medium" ? 0.88 : 1;
  const raw =
    (0.32 * margin + 0.18 * roi + 0.22 * demand + 0.14 * competition + 0.08 * speed + 0.06 * logistics) *
    ipPenalty;
  return Math.round(clamp(raw) * 100);
}

export function pickDefaultMethod(weightKg: number, volumeCbm: number): ShippingMethod {
  const volKg = volumetricKg(volumeCbm);
  if (weightKg <= 0.25 && volKg <= 0.4) return "express";
  if (weightKg <= 1.8 && volumeCbm <= 0.008) return "air";
  return "sea_lcl";
}

export function methodLabel(method: ShippingMethod) {
  switch (method) {
    case "express":
      return "国际快递";
    case "air":
      return "空运专线";
    case "sea_lcl":
      return "海运散货 LCL";
    case "sea_fcl":
      return "海运整柜 FCL";
  }
}

export type Grade = { grade: "S" | "A" | "B" | "C"; label: string; color: string };

/**
 * 把综合分映射成 S/A/B/C 评级。
 *
 * 阈值针对的是本仓 opportunityScore 的 0~100 分布（实测集中在 30~85），
 * 与 PRD 5.5 节里那套基于另一公式的分段不是同一标尺，不要互相套用。
 */
export function gradeOf(score: number): Grade {
  if (score >= 70) return { grade: "S", label: "S · 强推", color: "#34d399" };
  if (score >= 55) return { grade: "A", label: "A · 推荐", color: "#38bdf8" };
  if (score >= 40) return { grade: "B", label: "B · 观察", color: "#fbbf24" };
  return { grade: "C", label: "C · 谨慎", color: "#fb7185" };
}

export function rankOpportunities(items: Opportunity[]) {
  return [...items].sort((a, b) => b.score - a.score || b.result.marginPct - a.result.marginPct);
}
