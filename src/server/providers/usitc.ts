import type { Sourced, TariffProvider } from "@/server/providers/types";

/**
 * 美国 USITC 协调关税表（HTS）。免费、无需 API Key。
 *
 * ⚠️ 只能取到 MFN 基础税率（Column 1 General）。
 * Section 301 / 232 / 强迫劳动等加征属于 Chapter 99 的独立条目，这个接口查不到。
 * 直接拿它覆盖测算里的关税率，会让中国商品的税负归零、利润被严重高估。
 * 加征部分见 lib/trade-remedies.ts。
 */

const ENDPOINT = "https://hts.usitc.gov/reststop/search";

type HtsRow = {
  htsno?: string;
  description?: string;
  /** Column 1 General：MFN 税率，形如 "Free" / "4.9%" / "2.4¢/kg" */
  general?: string | null;
};

/**
 * 解析 HTS 税率字符串。
 * 只认从价税（百分比）与 Free；从量税（如 "2.4¢/kg"）无法折算成比率，返回 null 由调用方处理。
 */
export function parseHtsRate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^free$/i.test(s)) return 0;
  const m = s.match(/^([\d.]+)\s*%/);
  if (!m) return null; // 从量税或复合税，不做猜测
  const pct = Number(m[1]);
  return Number.isFinite(pct) ? pct / 100 : null;
}

/** 归一化 HS 编码用于比对：去掉点与空格 */
function normalize(hs: string) {
  return hs.replace(/[.\s]/g, "");
}

export function createUsitcTariffProvider(fetchImpl: typeof fetch = fetch): TariffProvider {
  return {
    name: "USITC HTS（仅 MFN 基础税率）",
    market: "US",

    async mfnDutyRate(hsCode: string): Promise<Sourced<number | null>> {
      const url = `${ENDPOINT}?keyword=${encodeURIComponent(hsCode)}`;
      const res = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`USITC 返回 ${res.status}`);

      const rows = (await res.json()) as HtsRow[];
      const target = normalize(hsCode);

      // 取前缀匹配且带税率的最细一级条目——HTS 的税率挂在 8~10 位的叶子上，
      // 6 位的税目行 general 是空的。
      const candidates = rows
        .filter((r) => r.htsno && normalize(r.htsno).startsWith(target))
        .filter((r) => parseHtsRate(r.general) !== null)
        .sort((a, b) => normalize(a.htsno!).length - normalize(b.htsno!).length);

      const hit = candidates[0];
      return {
        value: hit ? parseHtsRate(hit.general) : null,
        source: hit ? `USITC HTS ${hit.htsno}` : "USITC HTS（未匹配到从价税条目）",
        fetchedAt: new Date(),
        fallback: false,
      };
    },
  };
}
