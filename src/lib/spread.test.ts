import { describe, expect, it } from "vitest";
import { discoverSpread, spreadScore, type MarketQuote, type SourceProbe } from "@/lib/spread";
import { buildSeedCatalog } from "@/server/store/seed-catalog";
import type { CalcResult } from "@/lib/types";

const catalog = buildSeedCatalog();

const probe: SourceProbe = {
  nameZh: "测试蓝牙耳机",
  sourcePriceCny: 28.5,
  weightKg: 0.085,
  volumeCbm: 0.0004,
  hsCode: "8518.30",
};

function quote(market: string, sellPrice: number): MarketQuote {
  return { marketCode: market, platform: "Amazon", sellPrice, source: "测试" };
}

describe("价差发现", () => {
  it("按净利排序，而不是按毛差价", () => {
    // DE 售价低于 US，但德国无 12.5% 强迫劳动加征，净利可能更高。
    // 无论谁赢，排序必须与净利一致。
    const r = discoverSpread(catalog, probe, [quote("US", 19.99), quote("DE", 21.9), quote("JP", 2480)], {
      asOf: new Date("2026-09-12T00:00:00Z"),
    });
    expect(r.rows.length).toBe(3);
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1].result.netProfitUsd).toBeGreaterThanOrEqual(r.rows[i].result.netProfitUsd);
    }
    expect(r.best?.marketCode).toBe(r.rows[0].marketCode);
  });

  it("毛差价高不等于净利高——这正是要纠正的行业误区", () => {
    const r = discoverSpread(catalog, probe, [quote("US", 19.99)], {
      asOf: new Date("2026-09-12T00:00:00Z"),
    });
    const row = r.rows[0];
    // 售价约 ¥134 对采购价 ¥28.5，毛差价 300%+，但净利率只有二十几
    expect(row.grossSpreadPct).toBeGreaterThan(200);
    expect(row.result.marginPct).toBeLessThan(40);
  });

  it("美国的关税包含 12.5% 强迫劳动加征", () => {
    const r = discoverSpread(catalog, probe, [quote("US", 19.99)], {
      asOf: new Date("2026-09-12T00:00:00Z"),
    });
    // 8518.30 MFN 0% + List 4A 7.5% + 强迫劳动 12.5% = 20%
    expect(r.rows[0].dutyRate).toBeCloseTo(0.2, 3);
  });

  it("按历史日期回溯时不计入尚未生效的加征", () => {
    const before = discoverSpread(catalog, probe, [quote("US", 19.99)], {
      asOf: new Date("2026-06-01T00:00:00Z"),
    });
    expect(before.rows[0].dutyRate).toBeCloseTo(0.075, 3);
  });

  it("标记低于小额免税门槛的市场", () => {
    // 澳大利亚门槛 $650，一个 $30 的商品远低于门槛
    const r = discoverSpread(catalog, probe, [quote("AU", 45)], {});
    expect(r.rows[0].deMinimisUsd).toBe(650);
    expect(r.rows[0].underDeMinimis).toBe(true);

    // 美国门槛为 0，任何金额都要计税
    const us = discoverSpread(catalog, probe, [quote("US", 19.99)], {});
    expect(us.rows[0].underDeMinimis).toBe(false);
  });

  it("未收录的市场进 skipped 而不是静默丢弃", () => {
    const r = discoverSpread(catalog, probe, [quote("US", 19.99), quote("ZZ", 10)], {});
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toEqual([
      { marketCode: "ZZ", reason: expect.stringContaining("未收录") },
    ]);
  });

  it("售价为 0 的报价被拒绝，不会算出天文利润率", () => {
    const r = discoverSpread(catalog, probe, [quote("US", 0)], {});
    expect(r.rows).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("0");
  });

  it("没有任何有效报价时 best 为 null 而不是崩溃", () => {
    const r = discoverSpread(catalog, probe, [], {});
    expect(r.best).toBeNull();
    expect(r.rows).toHaveLength(0);
  });

  it("重货自动选海运而非快递", () => {
    const heavy: SourceProbe = { ...probe, weightKg: 12, volumeCbm: 0.06 };
    const r = discoverSpread(catalog, heavy, [quote("US", 199)], {});
    expect(r.rows[0].shippingMethod).toBe("sea_lcl");
  });
});

describe("按需评级", () => {
  function res(marginPct: number, roiPct: number, netProfitUsd: number): CalcResult {
    return { marginPct, roiPct, netProfitUsd } as CalcResult;
  }

  it("高利润高 ROI 得高分", () => {
    expect(spreadScore(res(40, 120, 15))).toBe(100);
  });

  it("亏损不会得到负分或越界分", () => {
    const s = spreadScore(res(-20, -50, -3));
    expect(s).toBe(0);
  });

  it("分数恒在 0~100 之间", () => {
    for (const [m, r, n] of [[200, 500, 100], [0, 0, 0], [-999, -999, -999]] as const) {
      const s = spreadScore(res(m, r, n));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
