import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assistantMessages,
  categories,
  customsTariffs,
  fxRates,
  marketListings,
  markets,
  platformFees,
  products,
  savedCalcs,
  listingSnapshots,
  shippingRates,
  subcategories,
  watchlist,
  type ListingSnapshot,
  type NewListingSnapshot,
  type WatchItem,
} from "@/db/schema";
import { buildSeedCatalog } from "@/server/store/seed-catalog";
import {
  normalizeKeyword,
  type AssistantMessage,
  type Catalog,
  type SavedCalc,
  type TradeStore,
} from "@/server/store/types";

/** 灌种子后需要把 serial 序列推到 max(id)，否则后续插入会撞上已占用的主键。 */
const SEEDED_TABLES = [
  "markets",
  "fx_rates",
  "categories",
  "subcategories",
  "products",
  "market_listings",
  "shipping_rates",
  "customs_tariffs",
  "platform_fees",
] as const;

class PostgresStore implements TradeStore {
  readonly kind = "postgres" as const;
  readonly durable = true;

  private seedPromise: Promise<void> | null = null;

  /** 幂等灌种子：空库才写入，失败时重置 promise 以便下次请求重试。 */
  private ensureSeeded(): Promise<void> {
    this.seedPromise ??= this.seedIfEmpty().catch((error) => {
      this.seedPromise = null;
      throw error;
    });
    return this.seedPromise;
  }

  private async seedIfEmpty(): Promise<void> {
    const db = getDb();
    const existing = await db.select({ id: markets.id }).from(markets).limit(1);
    if (existing.length > 0) return;

    const seed = buildSeedCatalog();

    // 显式带 id 插入，保证与内存实现的主键一致。
    await db.transaction(async (tx) => {
      await tx.insert(markets).values(seed.markets);
      await tx.insert(fxRates).values(seed.fx);
      await tx.insert(categories).values(seed.categories);
      await tx.insert(subcategories).values(seed.subcategories);
      await tx.insert(products).values(seed.products);
      await tx.insert(marketListings).values(seed.listings);
      await tx.insert(shippingRates).values(seed.shipping);
      await tx.insert(customsTariffs).values(seed.tariffs);
      await tx.insert(platformFees).values(seed.fees);

      for (const table of SEEDED_TABLES) {
        await tx.execute(
          sql`select setval(pg_get_serial_sequence(${table}, 'id'), coalesce((select max(id) from ${sql.identifier(table)}), 1))`,
        );
      }
    });
  }

  async loadCatalog(): Promise<Catalog> {
    await this.ensureSeeded();
    const db = getDb();
    const [
      marketRows,
      categoryRows,
      subcategoryRows,
      productRows,
      listingRows,
      shippingRows,
      tariffRows,
      feeRows,
      fxRows,
    ] =
      await Promise.all([
        db.select().from(markets),
        db.select().from(categories),
        db.select().from(subcategories),
        db.select().from(products),
        db.select().from(marketListings),
        db.select().from(shippingRates),
        db.select().from(customsTariffs),
        db.select().from(platformFees),
        db.select().from(fxRates),
      ]);
    return {
      markets: marketRows,
      categories: categoryRows,
      subcategories: subcategoryRows,
      products: productRows,
      listings: listingRows,
      shipping: shippingRows,
      tariffs: tariffRows,
      fees: feeRows,
      fx: fxRows,
    };
  }

  async listWatchlist(): Promise<WatchItem[]> {
    await this.ensureSeeded();
    return getDb().select().from(watchlist).orderBy(desc(watchlist.createdAt));
  }

  async addWatch(input: { productId: number; marketId: number; note?: string }): Promise<void> {
    await this.ensureSeeded();
    await getDb()
      .insert(watchlist)
      .values({ productId: input.productId, marketId: input.marketId, note: input.note ?? "" })
      .onConflictDoNothing();
  }

  async removeWatch(input: { productId: number; marketId: number }): Promise<void> {
    await this.ensureSeeded();
    await getDb()
      .delete(watchlist)
      .where(and(eq(watchlist.productId, input.productId), eq(watchlist.marketId, input.marketId)));
  }

  async listSavedCalcs(): Promise<SavedCalc[]> {
    await this.ensureSeeded();
    return getDb().select().from(savedCalcs).orderBy(desc(savedCalcs.createdAt));
  }

  async saveCalc(input: Omit<SavedCalc, "id" | "createdAt">): Promise<void> {
    await this.ensureSeeded();
    await getDb().insert(savedCalcs).values(input);
  }

  async appendAssistantMessages(messages: AssistantMessage[]): Promise<void> {
    if (messages.length === 0) return;
    await this.ensureSeeded();
    await getDb().insert(assistantMessages).values(messages);
  }

  async getListingSnapshots(input: {
    marketCode: string;
    keyword: string;
    maxAgeMs: number;
  }): Promise<ListingSnapshot[]> {
    await this.ensureSeeded();
    const cutoff = new Date(Date.now() - input.maxAgeMs);
    return getDb()
      .select()
      .from(listingSnapshots)
      .where(
        and(
          eq(listingSnapshots.marketCode, input.marketCode),
          eq(listingSnapshots.keyword, normalizeKeyword(input.keyword)),
          gte(listingSnapshots.fetchedAt, cutoff),
        ),
      );
  }

  async saveListingSnapshots(rows: NewListingSnapshot[]): Promise<void> {
    if (rows.length === 0) return;
    await this.ensureSeeded();
    const now = new Date();
    await getDb()
      .insert(listingSnapshots)
      .values(rows.map((r) => ({ ...r, keyword: normalizeKeyword(r.keyword), fetchedAt: r.fetchedAt ?? now })))
      // 同一商品重复抓取只刷新价格与时间戳，不产生重复行
      .onConflictDoUpdate({
        target: [listingSnapshots.marketCode, listingSnapshots.keyword, listingSnapshots.asin],
        set: {
          title: sql`excluded.title`,
          price: sql`excluded.price`,
          currency: sql`excluded.currency`,
          rating: sql`excluded.rating`,
          reviewCount: sql`excluded.review_count`,
          url: sql`excluded.url`,
          source: sql`excluded.source`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }

  async ping(): Promise<boolean> {
    await getDb().execute(sql`select 1`);
    return true;
  }
}

export function createPostgresStore(): TradeStore {
  return new PostgresStore();
}
