export type ShippingMethod = "express" | "air" | "sea_lcl" | "sea_fcl";

export type CalcInput = {
  sourcePriceCny: number;
  quantity: number;
  weightKg: number;
  volumeCbm: number;
  sellPriceLocal: number;
  sellCurrency: string;
  cnyPerSellCurrency: number;
  cnyPerUsd: number;
  shippingMethod: ShippingMethod;
  ratePerKgUsd: number;
  ratePerCbmUsd: number;
  minChargeUsd: number;
  dutyRate: number;
  vatRate: number;
  vatRecoverable: boolean;
  platformReferralRate: number;
  fulfillmentPerUnitUsd: number;
  paymentFeeRate: number;
  adsRate: number;
  returnRate: number;
  insuranceRate: number;
  packingPerUnitUsd: number;
  inspectionPerOrderUsd: number;
};

export type CostLine = {
  key: string;
  label: string;
  usd: number;
  note?: string;
};

export type CalcResult = {
  quantity: number;
  goodsUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  packingUsd: number;
  inspectionUsd: number;
  cifUsd: number;
  dutyUsd: number;
  vatUsd: number;
  vatAsCostUsd: number;
  landedUsd: number;
  sellUsd: number;
  referralUsd: number;
  paymentUsd: number;
  fulfillmentUsd: number;
  adsUsd: number;
  returnsUsd: number;
  totalFeesUsd: number;
  netProfitUsd: number;
  netProfitOrderUsd: number;
  marginPct: number;
  roiPct: number;
  revenueUsd: number;
  chargeableKg: number;
  lines: CostLine[];
  verdict: "go" | "thin" | "no";
  verdictLabel: string;
};

export type Opportunity = {
  productId: number;
  sku: string;
  nameZh: string;
  nameEn: string;
  imageUrl: string;
  categorySlug: string;
  categoryName: string;
  hsCode: string;
  sourcePriceCny: number;
  supplierPlatform: string;
  weightKg: number;
  /** 实际适用的关税率（MFN + 附加），0~1 */
  dutyRate: number;
  /** 实际适用的增值税率，0~1 */
  vatRate: number;
  marketId: number;
  marketCode: string;
  marketName: string;
  flag: string;
  platform: string;
  sellPriceLocal: number;
  currency: string;
  monthlySales: number;
  demandScore: number;
  competition: number;
  trend: string;
  shippingMethod: ShippingMethod;
  shippingLabel: string;
  daysMin: number;
  daysMax: number;
  result: CalcResult;
  score: number;
};
