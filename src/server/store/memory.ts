import type { ListingSnapshot, NewListingSnapshot, WatchItem } from "@/db/schema";
import { buildSeedCatalog } from "@/server/store/seed-catalog";
import {
  normalizeKeyword,
  type AssistantMessage,
  type Catalog,
  type SavedCalc,
  type TradeStore,
} from "@/server/store/types";

/**
 * 进程内存实现：未配置 DATABASE_URL 时使用。
 *
 * 目录数据来自种子常量且只读；watchlist / savedCalcs / assistantMessages 可写，
 * 但随进程结束丢失——UI 会显式提示当前处于演示模式，不会让用户误以为数据已落库。
 */
class MemoryStore implements TradeStore {
  readonly kind = "memory" as const;
  readonly durable = false;

  private readonly catalog: Catalog = buildSeedCatalog();
  private readonly watches: WatchItem[] = [];
  private readonly calcs: SavedCalc[] = [];
  private readonly messages: (AssistantMessage & { id: number; createdAt: Date })[] = [];
  private readonly snapshots: ListingSnapshot[] = [];
  private nextId = 1;

  async loadCatalog(): Promise<Catalog> {
    return this.catalog;
  }

  async listWatchlist(): Promise<WatchItem[]> {
    return [...this.watches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addWatch(input: { productId: number; marketId: number; note?: string }): Promise<void> {
    const exists = this.watches.some(
      (w) => w.productId === input.productId && w.marketId === input.marketId,
    );
    if (exists) return;
    this.watches.push({
      id: this.nextId++,
      productId: input.productId,
      marketId: input.marketId,
      note: input.note ?? "",
      createdAt: new Date(),
    });
  }

  async removeWatch(input: { productId: number; marketId: number }): Promise<void> {
    const i = this.watches.findIndex(
      (w) => w.productId === input.productId && w.marketId === input.marketId,
    );
    if (i >= 0) this.watches.splice(i, 1);
  }

  async listSavedCalcs(): Promise<SavedCalc[]> {
    return [...this.calcs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveCalc(input: Omit<SavedCalc, "id" | "createdAt">): Promise<void> {
    this.calcs.push({ ...input, id: this.nextId++, createdAt: new Date() });
  }

  async appendAssistantMessages(messages: AssistantMessage[]): Promise<void> {
    for (const m of messages) {
      this.messages.push({ ...m, id: this.nextId++, createdAt: new Date() });
    }
  }

  async getListingSnapshots(input: {
    marketCode: string;
    keyword: string;
    maxAgeMs: number;
  }): Promise<ListingSnapshot[]> {
    const key = normalizeKeyword(input.keyword);
    const cutoff = Date.now() - input.maxAgeMs;
    return this.snapshots.filter(
      (s) => s.marketCode === input.marketCode && s.keyword === key && s.fetchedAt.getTime() >= cutoff,
    );
  }

  async saveListingSnapshots(rows: NewListingSnapshot[]): Promise<void> {
    for (const row of rows) {
      const key = normalizeKeyword(row.keyword);
      const i = this.snapshots.findIndex(
        (s) => s.marketCode === row.marketCode && s.keyword === key && s.asin === row.asin,
      );
      const record: ListingSnapshot = {
        id: i >= 0 ? this.snapshots[i].id : this.nextId++,
        marketCode: row.marketCode,
        keyword: key,
        asin: row.asin,
        title: row.title,
        price: row.price,
        currency: row.currency,
        rating: row.rating ?? null,
        reviewCount: row.reviewCount ?? null,
        url: row.url,
        source: row.source,
        fetchedAt: row.fetchedAt ?? new Date(),
      };
      if (i >= 0) this.snapshots[i] = record;
      else this.snapshots.push(record);
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

/**
 * 开发模式下 Next.js 会热重载模块，实例挂到 globalThis 上，
 * 否则用户加到自选的商品会在每次改代码后消失。
 */
const globalForStore = globalThis as typeof globalThis & {
  __tradeLensMemoryStore?: MemoryStore;
};

export function createMemoryStore(): TradeStore {
  if (process.env.NODE_ENV === "production") return new MemoryStore();
  globalForStore.__tradeLensMemoryStore ??= new MemoryStore();
  return globalForStore.__tradeLensMemoryStore;
}
