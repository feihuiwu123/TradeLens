import type {
  Category,
  CustomsTariff,
  FxRate,
  Market,
  MarketListing,
  PlatformFee,
  Product,
  ShippingRate,
  ListingSnapshot,
  NewListingSnapshot,
  Subcategory,
  WatchItem,
} from "@/db/schema";

/** 一次性加载的全量参考数据快照。所有测算都基于同一份快照，避免跨表读取时的口径漂移。 */
export type Catalog = {
  markets: Market[];
  categories: Category[];
  subcategories: Subcategory[];
  products: Product[];
  listings: MarketListing[];
  shipping: ShippingRate[];
  tariffs: CustomsTariff[];
  fees: PlatformFee[];
  fx: FxRate[];
};

export type SavedCalc = {
  id: number;
  title: string;
  payload: Record<string, unknown>;
  netProfitUsd: number;
  marginPct: number;
  createdAt: Date;
};

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * 数据访问接口。业务代码只依赖这个接口，不直接 import drizzle。
 *
 * 两套实现：
 * - PostgresStore：生产路径，数据可持久化。
 * - MemoryStore：未配置 DATABASE_URL 时的降级路径，进程内可读写，重启即丢。
 */
export type TradeStore = {
  /** 用于 /api/health 与页面顶部的模式标识 */
  readonly kind: "postgres" | "memory";
  /** 数据是否会在进程重启后保留 */
  readonly durable: boolean;

  loadCatalog(): Promise<Catalog>;

  listWatchlist(): Promise<WatchItem[]>;
  addWatch(input: { productId: number; marketId: number; note?: string }): Promise<void>;
  removeWatch(input: { productId: number; marketId: number }): Promise<void>;

  listSavedCalcs(): Promise<SavedCalc[]>;
  saveCalc(input: Omit<SavedCalc, "id" | "createdAt">): Promise<void>;

  appendAssistantMessages(messages: AssistantMessage[]): Promise<void>;

  /**
   * 读取未过期的商品快照。
   * 返回空数组表示缓存未命中或已过期，调用方需要重新抓取。
   */
  getListingSnapshots(input: {
    marketCode: string;
    keyword: string;
    maxAgeMs: number;
  }): Promise<ListingSnapshot[]>;

  /** 写入/更新快照。按 (market, keyword, asin) 去重，重复抓取只刷新价格与时间戳。 */
  saveListingSnapshots(rows: NewListingSnapshot[]): Promise<void>;

  /** 连通性自检；内存实现恒为 true */
  ping(): Promise<boolean>;
};

/** 检索词归一化：大小写与多余空格不应导致缓存未命中 */
export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}
