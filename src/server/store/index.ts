import { createMemoryStore } from "@/server/store/memory";
import { createPostgresStore } from "@/server/store/postgres";
import type { TradeStore } from "@/server/store/types";

export type { Catalog, SavedCalc, TradeStore } from "@/server/store/types";

const globalForStore = globalThis as typeof globalThis & {
  __tradeLensStore?: TradeStore;
};

/**
 * 按环境选择数据后端。
 *
 * 配了 DATABASE_URL 走 Postgres；没配则回退到内存演示模式，
 * 让 `npm run dev` 开箱即用，不必先装数据库。
 */
export function getStore(): TradeStore {
  if (globalForStore.__tradeLensStore) return globalForStore.__tradeLensStore;

  const store = process.env.DATABASE_URL ? createPostgresStore() : createMemoryStore();

  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    console.warn(
      "[TradeLens] 未配置 DATABASE_URL，正在以内存演示模式运行：自选与测算记录不会持久化。",
    );
  }

  globalForStore.__tradeLensStore = store;
  return store;
}
