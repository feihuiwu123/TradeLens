/**
 * 贸易救济措施（关税加征）表。
 *
 * 为什么要和 HS 税则分开存：
 * MFN 基础税率按商品归类走，相对稳定，可以从 USITC/TARIC 这类官方税则库校准；
 * 而 301/232/强迫劳动这类加征按「原产地 + 政策」走，变动极快且有明确起止日期，
 * 官方税则接口里查不到（它们是 Chapter 99 的独立条目）。
 *
 * 两者混在一个数字里会导致两个后果：
 * 1. 用税则接口刷新时会把加征部分洗掉，中国商品关税直接归零，利润被严重高估；
 * 2. 政策到期后无法回溯「当时是按哪版税率算的」。
 */

export type TradeMeasure = {
  id: string;
  /** 目的国代码 */
  market: string;
  /** 原产地。本产品所有货源均为中国，故目前只有 CN */
  origin: "CN";
  /** 加征税率，0~1 */
  rate: number;
  /** 生效日（含），ISO 日期 */
  effectiveFrom: string;
  /** 失效日（含）。留空表示暂无明确终止日 */
  effectiveUntil?: string;
  /** 法律依据 */
  authority: string;
  note: string;
};

/**
 * 现行措施。每次改动都要附来源与日期，便于审计。
 *
 * 重要背景（2026-02-20）：美国最高法院在 Learning Resources / V.O.S. Selections 案中
 * 以 6:3 裁定 IEEPA 不授权总统加征关税，IEEPA 项下的「芬太尼关税」与「对等关税」被推翻，
 * 总统随后签署行政令终止相关加征。
 *
 * 但 Section 301 依据的是 1974 年贸易法第 301 条这一独立授权，未受该裁决影响，仍全面生效。
 * 因此对华实际税负并未随 IEEPA 一同消失——这是最容易误判的地方。
 */
export const TRADE_MEASURES: TradeMeasure[] = [
  {
    id: "us-301-forced-labor",
    market: "US",
    origin: "CN",
    rate: 0.125,
    effectiveFrom: "2026-07-24",
    authority: "Section 301（强迫劳动调查）",
    note:
      "2026-07-24 起替代已到期的 Section 122 临时 10% 附加税，对中国原产商品统一加征 12.5%。" +
      "Section 232 项下商品（钢铝铜及其制品、整车与零部件、木制品、半导体等）不叠加此项。",
  },
];

/** 判断某项措施在给定日期是否生效 */
export function isMeasureActive(m: TradeMeasure, asOf: Date): boolean {
  const day = asOf.toISOString().slice(0, 10);
  if (day < m.effectiveFrom) return false;
  if (m.effectiveUntil && day > m.effectiveUntil) return false;
  return true;
}

/**
 * 取某目的国在给定日期对中国原产商品的额外加征（不含 HS 税则里的 301 清单税率）。
 *
 * 返回 measures 是为了让 UI 能逐条列出「这笔税是依据什么加的」，
 * 而不是甩一个合计数字。
 */
export function additionalDutyRate(
  market: string,
  asOf: Date = new Date(),
): { rate: number; measures: TradeMeasure[] } {
  const measures = TRADE_MEASURES.filter(
    (m) => m.market === market && isMeasureActive(m, asOf),
  );
  return { rate: measures.reduce((s, m) => s + m.rate, 0), measures };
}

/**
 * 已知的政策悬崖，用于在 UI 上提前预警。
 * 到期后税负会跳变，按旧税率做的备货测算会失效。
 */
export const POLICY_CLIFFS = [
  {
    date: "2026-11-10",
    market: "US",
    title: "对华 301 排除清单与中美关税休战同时到期",
    detail:
      "178 项现行排除措施与 2025-11-01 中美元首会晤达成的降税安排均在 2026-11-10 到期（消费入境截止 11-09 23:59 ET）。" +
      "目前未开放新的排除申请通道。若不延期，相关商品税负将上行。",
  },
] as const;

/** 距离最近一个政策悬崖还有多少天；已过期返回负数 */
export function daysToCliff(cliffDate: string, asOf: Date = new Date()): number {
  const target = new Date(`${cliffDate}T00:00:00Z`).getTime();
  const now = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((target - now) / 86_400_000);
}
