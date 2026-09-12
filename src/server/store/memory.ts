import type { WatchItem } from "@/db/schema";
import { buildSeedCatalog } from "@/server/store/seed-catalog";
import type { AssistantMessage, Catalog, SavedCalc, TradeStore } from "@/server/store/types";

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
