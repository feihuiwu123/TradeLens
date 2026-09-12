/**
 * 外部数据源抽象。
 *
 * 三条设计约束：
 * 1. 每个返回值都带 source 与 fetchedAt——混着实测值和基准值却不标注来源，
 *    比全是基准值更危险，使用者无法判断哪个数字可以拿去下单。
 * 2. 外部源必须可失败。任何 provider 挂掉都只降级到种子基准值，不阻断测算。
 * 3. provider 只负责取数与归一化，不做业务判断。
 */

export type Sourced<T> = {
  value: T;
  /** 数据来源标识，会展示给用户 */
  source: string;
  fetchedAt: Date;
  /** true 表示这是兜底的模型基准值，不是实测值 */
  fallback: boolean;
};

export type FxProvider = {
  readonly name: string;
  /** 返回 1 单位外币折合多少人民币 */
  cnyPer(currencies: string[]): Promise<Sourced<Record<string, number>>>;
};

/** 官方税则库只提供 MFN 基础税率，不含 301/232 等加征（那些在 trade-remedies 里） */
export type TariffProvider = {
  readonly name: string;
  readonly market: string;
  mfnDutyRate(hsCode: string): Promise<Sourced<number | null>>;
};
