import type { FxProvider, Sourced } from "@/server/providers/types";

/**
 * 欧洲央行每日参考汇率。
 *
 * 选它而不是商业实时汇率的原因：报关完税价格应当用官方汇率
 * （美国 CBP 每周、欧盟 ECB 每日），商业 feed 适合展示、不适合计税口径。
 * 免费、无需 API Key、无注册。
 *
 * ECB 一律以欧元为基准报价（CURRENCY 单位 / 1 EUR），所以人民币口径要做交叉换算：
 *   cnyPerUnit(C) = (CNY per EUR) / (C per EUR)
 */

const ENDPOINT = "https://data-api.ecb.europa.eu/service/data/EXR";

/** ECB 不发布的币种（如盯住美元的 AED），调用方需自行回退 */
function parseCsv(csv: string): { rates: Map<string, number>; day: string | null } {
  const rates = new Map<string, number>();
  let day: string | null = null;

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return { rates, day };

  const header = lines[0].split(",");
  const iCur = header.indexOf("CURRENCY");
  const iVal = header.indexOf("OBS_VALUE");
  const iDay = header.indexOf("TIME_PERIOD");
  if (iCur < 0 || iVal < 0) return { rates, day };

  for (const line of lines.slice(1)) {
    // 后面的 TITLE 字段含带逗号的引号串，但我们要的三列都在其之前，按逗号切分足够
    const cols = line.split(",");
    const cur = cols[iCur];
    const val = Number(cols[iVal]);
    if (!cur || !Number.isFinite(val) || val <= 0) continue;
    rates.set(cur, val);
    if (iDay >= 0 && cols[iDay]) day = cols[iDay];
  }
  return { rates, day };
}

export function createEcbFxProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    name: "ECB 每日参考汇率",

    async cnyPer(currencies: string[]): Promise<Sourced<Record<string, number>>> {
      // CNY 自身恒为 1，不必向 ECB 查；但交叉换算需要 CNY/EUR，所以必须带上
      const wanted = Array.from(new Set(["CNY", ...currencies.filter((c) => c !== "CNY")]));
      const series = `D.${wanted.join("+")}.EUR.SP00.A`;
      const url = `${ENDPOINT}/${series}?lastNObservations=1&format=csvdata`;

      const res = await fetchImpl(url, {
        headers: { accept: "text/csv" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`ECB 返回 ${res.status}`);

      const { rates, day } = parseCsv(await res.text());
      const cnyPerEur = rates.get("CNY");
      if (!cnyPerEur) throw new Error("ECB 未返回 CNY/EUR，无法换算人民币口径");

      const out: Record<string, number> = { CNY: 1, EUR: cnyPerEur };
      for (const [cur, perEur] of rates) {
        if (cur === "CNY") continue;
        out[cur] = cnyPerEur / perEur;
      }

      return {
        value: out,
        source: `ECB 参考汇率${day ? ` ${day}` : ""}`,
        fetchedAt: new Date(),
        fallback: false,
      };
    },
  };
}
