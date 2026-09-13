import { describe, expect, it } from "vitest";
import {
  breakevenPriceLocal,
  calculateProfit,
  chargeableWeightKg,
  freightPerUnitUsd,
  pickDefaultMethod,
  volumetricKg,
} from "@/lib/profit";
import type { CalcInput } from "@/lib/types";

/** 一个干净的基准入参：1 件、汇率 1、无税无费，方便逐项加压测试单个变量。 */
function baseInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    sourcePriceCny: 100,
    quantity: 1,
    weightKg: 1,
    volumeCbm: 0,
    sellPriceLocal: 100,
    sellCurrency: "USD",
    cnyPerSellCurrency: 1,
    cnyPerUsd: 1,
    shippingMethod: "express",
    ratePerKgUsd: 0,
    ratePerCbmUsd: 0,
    minChargeUsd: 0,
    dutyRate: 0,
    vatRate: 0,
    vatRecoverable: false,
    platformReferralRate: 0,
    fulfillmentPerUnitUsd: 0,
    paymentFeeRate: 0,
    adsRate: 0,
    returnRate: 0,
    insuranceRate: 0,
    packingPerUnitUsd: 0,
    inspectionPerOrderUsd: 0,
    ...overrides,
  };
}

describe("计费重", () => {
  it("体积重按 1 CBM = 167kg 折算", () => {
    expect(volumetricKg(1)).toBe(167);
    expect(volumetricKg(0.006)).toBeCloseTo(1.002, 3);
  });

  it("快递/空运取实重与体积重的较大者（泡货按体积计费）", () => {
    // 0.05 CBM = 8.35kg 体积重，远大于 1kg 实重
    expect(chargeableWeightKg(1, 0.05, "express")).toBeCloseTo(8.35, 2);
    expect(chargeableWeightKg(1, 0.05, "air")).toBeCloseTo(8.35, 2);
    // 重货：实重占优
    expect(chargeableWeightKg(20, 0.05, "express")).toBe(20);
  });

  it("海运不走体积重折算，按实重返回（运费另按 CBM 计）", () => {
    expect(chargeableWeightKg(1, 0.05, "sea_lcl")).toBe(1);
    expect(chargeableWeightKg(1, 0.05, "sea_fcl")).toBe(1);
  });
});

describe("运费", () => {
  it("快递按计费重 × 每公斤单价", () => {
    const usd = freightPerUnitUsd({
      quantity: 10,
      weightKg: 2,
      volumeCbm: 0,
      shippingMethod: "express",
      ratePerKgUsd: 8,
      ratePerCbmUsd: 0,
      minChargeUsd: 0,
    });
    expect(usd).toBe(16);
  });

  it("海运按 CBM × 每方单价，忽略每公斤单价", () => {
    const usd = freightPerUnitUsd({
      quantity: 1,
      weightKg: 500,
      volumeCbm: 2,
      shippingMethod: "sea_lcl",
      ratePerKgUsd: 999,
      ratePerCbmUsd: 145,
      minChargeUsd: 0,
    });
    expect(usd).toBe(290);
  });

  it("最低收费按件数摊薄后参与取大", () => {
    // 单价算出来 1 美元/件，但最低收费 100 摊到 10 件 = 10/件，取 10
    const usd = freightPerUnitUsd({
      quantity: 10,
      weightKg: 1,
      volumeCbm: 0,
      shippingMethod: "express",
      ratePerKgUsd: 1,
      ratePerCbmUsd: 0,
      minChargeUsd: 100,
    });
    expect(usd).toBe(10);
  });
});

describe("海关计税口径", () => {
  it("关税以 CIF 为基数，而不是货值", () => {
    const r = calculateProfit(
      baseInput({
        sourcePriceCny: 100,
        weightKg: 1,
        ratePerKgUsd: 50, // 运费 50
        insuranceRate: 0.1, // 保费 10
        dutyRate: 0.1,
      }),
    );
    // CIF = 100 货值 + 50 运费 + 10 保费 = 160
    expect(r.cifUsd).toBeCloseTo(160, 6);
    // 关税 = 160 × 10% = 16，而不是 100 × 10% = 10
    expect(r.dutyUsd).toBeCloseTo(16, 6);
  });

  it("VAT 计税基 = CIF + 关税（复利叠加，不是只对 CIF 征）", () => {
    const r = calculateProfit(baseInput({ sourcePriceCny: 100, dutyRate: 0.1, vatRate: 0.2 }));
    expect(r.cifUsd).toBeCloseTo(100, 6);
    expect(r.dutyUsd).toBeCloseTo(10, 6);
    // VAT = (100 + 10) × 20% = 22，而不是 100 × 20% = 20
    expect(r.vatUsd).toBeCloseTo(22, 6);
  });

  it("VAT 可抵扣时不计入到岸成本，但仍要报出税额", () => {
    const recoverable = calculateProfit(baseInput({ vatRate: 0.2, vatRecoverable: true }));
    const cost = calculateProfit(baseInput({ vatRate: 0.2, vatRecoverable: false }));

    expect(recoverable.vatUsd).toBeCloseTo(20, 6);
    expect(recoverable.vatAsCostUsd).toBe(0);
    expect(cost.vatAsCostUsd).toBeCloseTo(20, 6);
    expect(cost.landedUsd - recoverable.landedUsd).toBeCloseTo(20, 6);
  });
});

describe("利润与结论", () => {
  it("净利 = 售价 - 到岸成本 - 平台侧费用", () => {
    const r = calculateProfit(
      baseInput({
        sourcePriceCny: 20,
        sellPriceLocal: 100,
        platformReferralRate: 0.15,
        paymentFeeRate: 0.03,
        fulfillmentPerUnitUsd: 5,
      }),
    );
    // 到岸 20；平台 15 + 支付 3 + 履约 5 = 23；净利 = 100 - 20 - 23 = 57
    expect(r.landedUsd).toBeCloseTo(20, 6);
    expect(r.totalFeesUsd).toBeCloseTo(23, 6);
    expect(r.netProfitUsd).toBeCloseTo(57, 6);
    expect(r.marginPct).toBeCloseTo(57, 6);
  });

  it("退货损耗按 55% 折损计提（退回可二次销售部分不算全损）", () => {
    const r = calculateProfit(baseInput({ sellPriceLocal: 100, returnRate: 0.1 }));
    expect(r.returnsUsd).toBeCloseTo(5.5, 6);
  });

  it("验货费按订单量摊薄到单件", () => {
    const one = calculateProfit(baseInput({ quantity: 1, inspectionPerOrderUsd: 100 }));
    const many = calculateProfit(baseInput({ quantity: 100, inspectionPerOrderUsd: 100 }));
    expect(one.inspectionUsd).toBeCloseTo(100, 6);
    expect(many.inspectionUsd).toBeCloseTo(1, 6);
  });

  it("倒挂时给出 no，并允许净利为负", () => {
    const r = calculateProfit(baseInput({ sourcePriceCny: 200, sellPriceLocal: 100 }));
    expect(r.netProfitUsd).toBeLessThan(0);
    expect(r.verdict).toBe("no");
  });

  it("高利润给出 go", () => {
    const r = calculateProfit(baseInput({ sourcePriceCny: 20, sellPriceLocal: 100 }));
    expect(r.verdict).toBe("go");
  });

  it("汇率换算：非美元售价按本币汇率折回美元", () => {
    // 日元售价 3000，1 JPY = 0.048 CNY，1 USD = 7.25 CNY
    const r = calculateProfit(
      baseInput({ sellPriceLocal: 3000, sellCurrency: "JPY", cnyPerSellCurrency: 0.048, cnyPerUsd: 7.25 }),
    );
    expect(r.sellUsd).toBeCloseTo((3000 * 0.048) / 7.25, 6);
  });

  it("售价为 0 时不产生 NaN 利润率", () => {
    const r = calculateProfit(baseInput({ sellPriceLocal: 0 }));
    expect(Number.isFinite(r.marginPct)).toBe(true);
    expect(r.marginPct).toBe(0);
  });

  it("成本全为 0 时 ROI 不炸成 Infinity", () => {
    const r = calculateProfit(baseInput({ sourcePriceCny: 0, sellPriceLocal: 50 }));
    expect(Number.isFinite(r.roiPct)).toBe(true);
  });
});

describe("默认物流选择", () => {
  it("轻小件走快递", () => {
    expect(pickDefaultMethod(0.1, 0.0002)).toBe("express");
  });

  it("中等件走空运", () => {
    expect(pickDefaultMethod(1, 0.005)).toBe("air");
  });

  it("重货大件走海运", () => {
    expect(pickDefaultMethod(15, 0.08)).toBe("sea_lcl");
  });
});

describe("保本售价逆推", () => {
  const base: CalcInput = {
    sourcePriceCny: 28.5, quantity: 50, weightKg: 0.085, volumeCbm: 0.0004,
    sellPriceLocal: 19.99, sellCurrency: "USD", cnyPerSellCurrency: 6.7, cnyPerUsd: 6.7,
    shippingMethod: "express", ratePerKgUsd: 8, ratePerCbmUsd: 200, minChargeUsd: 10,
    dutyRate: 0.2, vatRate: 0, vatRecoverable: false,
    platformReferralRate: 0.15, fulfillmentPerUnitUsd: 3.45, paymentFeeRate: 0,
    adsRate: 0.08, returnRate: 0.05, insuranceRate: 0.003,
    packingPerUnitUsd: 0.18, inspectionPerOrderUsd: 40,
  };

  it("按保本价定价时净利恰好为 0", () => {
    // 这是保本价的定义，也是最能验证公式正确性的检查
    const be = breakevenPriceLocal(base);
    const r = calculateProfit({ ...base, sellPriceLocal: be });
    expect(r.netProfitUsd).toBeCloseTo(0, 6);
  });

  it("略高于保本价即为正利润，略低即亏损", () => {
    const be = breakevenPriceLocal(base);
    expect(calculateProfit({ ...base, sellPriceLocal: be * 1.01 }).netProfitUsd).toBeGreaterThan(0);
    expect(calculateProfit({ ...base, sellPriceLocal: be * 0.99 }).netProfitUsd).toBeLessThan(0);
  });

  it("关税越高保本价越高", () => {
    const low = breakevenPriceLocal({ ...base, dutyRate: 0 });
    const high = breakevenPriceLocal({ ...base, dutyRate: 0.2 });
    expect(high).toBeGreaterThan(low);
  });

  it("广告与佣金越高保本价越高", () => {
    expect(breakevenPriceLocal({ ...base, adsRate: 0.3 })).toBeGreaterThan(breakevenPriceLocal(base));
    expect(breakevenPriceLocal({ ...base, platformReferralRate: 0.3 })).toBeGreaterThan(breakevenPriceLocal(base));
  });

  it("可抵扣增值税不计入保本成本", () => {
    const withVat = { ...base, vatRate: 0.2 };
    expect(breakevenPriceLocal({ ...withVat, vatRecoverable: true })).toBeLessThan(
      breakevenPriceLocal({ ...withVat, vatRecoverable: false }),
    );
  });

  it("费率合计吃掉全部售价时返回 Infinity，而不是负数或 NaN", () => {
    // r >= 1 时无论定价多高都亏，不能返回一个看似可行的数字
    const doomed = breakevenPriceLocal({ ...base, platformReferralRate: 0.6, adsRate: 0.5 });
    expect(doomed).toBe(Infinity);
  });

  it("汇率为 0 时返回 Infinity 而不是除零", () => {
    expect(breakevenPriceLocal({ ...base, cnyPerSellCurrency: 0 })).toBe(Infinity);
  });
});
