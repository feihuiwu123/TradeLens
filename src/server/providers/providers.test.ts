import { describe, expect, it, vi } from "vitest";
import { createEcbFxProvider } from "@/server/providers/ecb";
import { createUsitcTariffProvider, parseHtsRate } from "@/server/providers/usitc";

/** 取自 ECB 真实返回（2026-09-11），只保留需要的列 */
const ECB_CSV = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE
EXR.D.CNY.EUR.SP00.A,D,CNY,EUR,SP00,A,2026-09-11,7.7762
EXR.D.GBP.EUR.SP00.A,D,GBP,EUR,SP00,A,2026-09-11,0.85815
EXR.D.JPY.EUR.SP00.A,D,JPY,EUR,SP00,A,2026-09-11,178.56
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-09-11,1.1592`;

function stubFetch(body: string, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, text: async () => body, json: async () => JSON.parse(body) }) as unknown as Response);
}

describe("ECB 汇率", () => {
  it("以欧元为基准交叉换算出人民币口径", async () => {
    const p = createEcbFxProvider(stubFetch(ECB_CSV));
    const { value } = await p.cnyPer(["USD", "JPY", "GBP"]);

    expect(value.CNY).toBe(1);
    expect(value.EUR).toBeCloseTo(7.7762, 4);
    // 7.7762 / 1.1592
    expect(value.USD).toBeCloseTo(6.7083, 3);
    expect(value.JPY).toBeCloseTo(0.04355, 5);
    expect(value.GBP).toBeCloseTo(9.0616, 3);
  });

  it("标注来源与观测日期，不能让实测值和基准值混淆", async () => {
    const p = createEcbFxProvider(stubFetch(ECB_CSV));
    const r = await p.cnyPer(["USD"]);
    expect(r.fallback).toBe(false);
    expect(r.source).toContain("2026-09-11");
  });

  it("缺少 CNY/EUR 时直接报错，而不是返回一个错的汇率", async () => {
    const csv = ECB_CSV.split("\n").filter((l) => !l.includes(".CNY.")).join("\n");
    const p = createEcbFxProvider(stubFetch(csv));
    await expect(p.cnyPer(["USD"])).rejects.toThrow(/CNY/);
  });

  it("HTTP 失败时抛错，交由上层降级", async () => {
    const p = createEcbFxProvider(stubFetch("", false, 503));
    await expect(p.cnyPer(["USD"])).rejects.toThrow(/503/);
  });
});

describe("HTS 税率解析", () => {
  it("Free 解析为 0", () => {
    expect(parseHtsRate("Free")).toBe(0);
    expect(parseHtsRate("free")).toBe(0);
  });

  it("从价税解析为小数", () => {
    expect(parseHtsRate("4.9%")).toBeCloseTo(0.049, 6);
    expect(parseHtsRate("2.4 %")).toBeCloseTo(0.024, 6);
  });

  it("从量税与复合税返回 null，不做猜测", () => {
    // 折算从量税需要单价与重量，凭字符串猜会得出离谱的税额
    expect(parseHtsRate("2.4¢/kg")).toBeNull();
    expect(parseHtsRate("$1.13/liter")).toBeNull();
    expect(parseHtsRate("")).toBeNull();
    expect(parseHtsRate(null)).toBeNull();
  });
});

describe("USITC 税则", () => {
  const ROWS = JSON.stringify([
    { htsno: "8518.30", description: "Headphones and earphones:", general: null },
    { htsno: "8518.30.10.00", description: "Line telephone handsets", general: "Free" },
    { htsno: "8518.30.20.00", description: "Other", general: "4.9%" },
  ]);

  it("跳过没有税率的税目行，取最细一级的叶子", async () => {
    const p = createUsitcTariffProvider(stubFetch(ROWS));
    const r = await p.mfnDutyRate("8518.30");
    expect(r.value).toBe(0);
    expect(r.source).toContain("8518.30.10.00");
  });

  it("HS 编码带点或不带点都能匹配", async () => {
    const p = createUsitcTariffProvider(stubFetch(ROWS));
    expect((await p.mfnDutyRate("851830")).value).toBe(0);
  });

  it("匹配不到时返回 null 而不是 0——0 会被当成免税", async () => {
    const p = createUsitcTariffProvider(stubFetch(JSON.stringify([])));
    const r = await p.mfnDutyRate("9999.99");
    expect(r.value).toBeNull();
  });
});
