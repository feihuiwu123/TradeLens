import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const markets = pgTable("markets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  currency: text("currency").notNull(),
  vatRate: real("vat_rate").notNull(),
  deMinimisUsd: real("de_minimis_usd").notNull(),
  demandIndex: integer("demand_index").notNull(),
  competitionIndex: integer("competition_index").notNull(),
  logisticsScore: integer("logistics_score").notNull(),
  notes: text("notes").notNull(),
  flag: text("flag").notNull(),
});

export const fxRates = pgTable("fx_rates", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull().unique(),
  cnyPerUnit: real("cny_per_unit").notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  hsChapter: text("hs_chapter").notNull(),
  typicalHs: text("typical_hs").notNull(),
  weightClass: text("weight_class").notNull(),
  riskLevel: text("risk_level").notNull(),
  recommended: integer("recommended").notNull(),
  reason: text("reason").notNull(),
});

/**
 * 子类目：按需查询（方式2）的实际入口粒度。
 *
 * 类目太粗（「3C 数码配件」无法给出 HS 与重量），单品太细（用户还没选定品）。
 * 子类目是既能定 HS、又能预填重量体积、还能挂合规红线的最小可用单位。
 */
export const subcategories = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").notNull(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  /** 代表性 HS 编码（6 位）。8~10 位叶子需用 USITC 现场解析 */
  hsCode: text("hs_code").notNull(),
  /** 同一子类目常跨税目，备选编码逗号分隔 */
  altHsCodes: text("alt_hs_codes").notNull().default(""),
  /** 是否已用官方税则库校验过。未校验的编码只能当起点，不能当依据 */
  hsVerified: integer("hs_verified").notNull().default(0),
  /** 预填测算器用的典型单件重量与体积 */
  typicalWeightKg: real("typical_weight_kg").notNull(),
  typicalVolumeCbm: real("typical_volume_cbm").notNull(),
  /** none | volumetric（抛货，体积重吃掉差价）| heavy（重货仅海运）| battery（带电空运受限） */
  logisticsFlag: text("logistics_flag").notNull().default("none"),
  /** ok | warn（需证书但可测算）| block（无证禁止进入候选池） */
  complianceLevel: text("compliance_level").notNull().default("ok"),
  requiredCerts: text("required_certs").notNull().default(""),
  note: text("note").notNull().default(""),
  keywords: text("keywords").notNull().default(""),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  categoryId: integer("category_id").notNull(),
  hsCode: text("hs_code").notNull(),
  weightKg: real("weight_kg").notNull(),
  volumeCbm: real("volume_cbm").notNull(),
  sourcePriceCny: real("source_price_cny").notNull(),
  moq: integer("moq").notNull(),
  supplierName: text("supplier_name").notNull(),
  supplierPlatform: text("supplier_platform").notNull(),
  leadDays: integer("lead_days").notNull(),
  demandScore: integer("demand_score").notNull(),
  trend: text("trend").notNull(),
  imageUrl: text("image_url").notNull(),
  description: text("description").notNull(),
  certifications: text("certifications").notNull(),
  ipRisk: text("ip_risk").notNull(),
});

export const marketListings = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  marketId: integer("market_id").notNull(),
  platform: text("platform").notNull(),
  sellPrice: real("sell_price").notNull(),
  monthlySales: integer("monthly_sales").notNull(),
  reviewCount: integer("review_count").notNull(),
  rating: real("rating").notNull(),
  competition: integer("competition").notNull(),
  bsr: integer("bsr").notNull(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  method: text("method").notNull(),
  methodZh: text("method_zh").notNull(),
  marketId: integer("market_id").notNull(),
  ratePerKgUsd: real("rate_per_kg_usd").notNull(),
  ratePerCbmUsd: real("rate_per_cbm_usd").notNull(),
  minChargeUsd: real("min_charge_usd").notNull(),
  daysMin: integer("days_min").notNull(),
  daysMax: integer("days_max").notNull(),
  notes: text("notes").notNull(),
});

export const customsTariffs = pgTable("customs_tariffs", {
  id: serial("id").primaryKey(),
  hsCode: text("hs_code").notNull(),
  marketId: integer("market_id").notNull(),
  mfnDuty: real("mfn_duty").notNull(),
  extraDuty: real("extra_duty").notNull(),
  vatRate: real("vat_rate").notNull(),
  notes: text("notes").notNull(),
});

export const platformFees = pgTable("platform_fees", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  marketId: integer("market_id").notNull(),
  referralRate: real("referral_rate").notNull(),
  fulfillmentPerUnitUsd: real("fulfillment_per_unit_usd").notNull(),
  paymentFeeRate: real("payment_fee_rate").notNull(),
});

export const watchlist = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    marketId: integer("market_id").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("watchlist_product_market").on(table.productId, table.marketId)],
);

export const savedCalcs = pgTable("saved_calcs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  netProfitUsd: real("net_profit_usd").notNull(),
  marginPct: real("margin_pct").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assistantMessages = pgTable("assistant_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Market = typeof markets.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type MarketListing = typeof marketListings.$inferSelect;
export type ShippingRate = typeof shippingRates.$inferSelect;
export type CustomsTariff = typeof customsTariffs.$inferSelect;
export type PlatformFee = typeof platformFees.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type WatchItem = typeof watchlist.$inferSelect;
