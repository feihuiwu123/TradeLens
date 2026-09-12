import { describe, expect, it } from "vitest";
import { TRADE_MEASURES, additionalDutyRate, daysToCliff, isMeasureActive } from "@/lib/trade-remedies";

const forcedLabor = TRADE_MEASURES.find((m) => m.id === "us-301-forced-labor")!;

describe("贸易救济措施生效判定", () => {
  it("生效日当天即计入（边界含当日）", () => {
    expect(isMeasureActive(forcedLabor, new Date("2026-07-24T00:00:00Z"))).toBe(true);
  });

  it("生效日前一天不计入", () => {
    expect(isMeasureActive(forcedLabor, new Date("2026-07-23T23:59:59Z"))).toBe(false);
  });

  it("有终止日的措施过期后不再计入", () => {
    const expired = { ...forcedLabor, effectiveUntil: "2026-08-01" };
    expect(isMeasureActive(expired, new Date("2026-08-01T00:00:00Z"))).toBe(true);
    expect(isMeasureActive(expired, new Date("2026-08-02T00:00:00Z"))).toBe(false);
  });
});

describe("额外加征税率", () => {
  it("2026-09 的美国：中国原产加征 12.5%", () => {
    const r = additionalDutyRate("US", new Date("2026-09-12T00:00:00Z"));
    expect(r.rate).toBeCloseTo(0.125, 6);
    expect(r.measures).toHaveLength(1);
    expect(r.measures[0].authority).toContain("Section 301");
  });

  it("措施生效前为 0，不能凭空加税", () => {
    expect(additionalDutyRate("US", new Date("2026-06-01T00:00:00Z")).rate).toBe(0);
  });

  it("未配置措施的市场返回 0", () => {
    expect(additionalDutyRate("DE", new Date("2026-09-12T00:00:00Z")).rate).toBe(0);
    expect(additionalDutyRate("JP", new Date("2026-09-12T00:00:00Z")).rate).toBe(0);
  });

  it("返回明细而不只是合计，便于审计每一笔加征的依据", () => {
    const r = additionalDutyRate("US", new Date("2026-09-12T00:00:00Z"));
    expect(r.measures.every((m) => m.authority && m.note && m.effectiveFrom)).toBe(true);
  });
});

describe("政策悬崖倒计时", () => {
  it("未到期返回正数", () => {
    expect(daysToCliff("2026-11-10", new Date("2026-09-12T00:00:00Z"))).toBe(59);
  });

  it("当天返回 0", () => {
    expect(daysToCliff("2026-11-10", new Date("2026-11-10T00:00:00Z"))).toBe(0);
  });

  it("已过期返回负数", () => {
    expect(daysToCliff("2026-11-10", new Date("2026-11-20T00:00:00Z"))).toBe(-10);
  });
});
