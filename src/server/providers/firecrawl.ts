import type { Sourced } from "@/server/providers/types";

/**
 * Firecrawl 抓取 + 结构化抽取。
 *
 * 为什么用它：实测普通 fetch 抓 Amazon / eBay / 1688 全部被反爬挡死
 * （Amazon 直接返回 "To discuss automated access" 拦截页），
 * 而 Mercado Libre 与 eBay 的公开 API 已分别关闭和改为 OAuth 强制。
 * Firecrawl 匿名调用即可穿透，且带 schema 的抽取能直接吐类型化字段。
 *
 * FIRECRAWL_API_KEY 可选：配了走配额账户，不配走匿名（有限流，够 MVP 验证）。
 */

const ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

export type ScrapedListing = {
  title: string;
  price: number;
  currency: string | null;
  inStock: boolean | null;
  rating: number | null;
  reviewCount: number | null;
};

const LISTING_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    price: {
      type: "number",
      description: "current buy-box price, numeric only, no currency symbol or thousands separator",
    },
    currency: { type: "string", description: "ISO 4217 code such as USD, EUR, JPY" },
    inStock: { type: "boolean" },
    rating: { type: "number" },
    reviewCount: { type: "integer" },
  },
  required: ["title", "price"],
} as const;

/** 明显不是商品页的标题特征。命中即判为抓取失败，而不是当成一个 0 元商品。 */
const NOT_A_PRODUCT = /page not found|404|dogs of amazon|sorry|robot check|captcha|not available/i;

export class ScrapeRejected extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "ScrapeRejected";
  }
}

/**
 * 校验闸门——本文件最重要的部分。
 *
 * 实测过的真实故障：抓 amazon.de 上一个不存在的 ASIN，页面是 404，
 * 但抽取模型没有失败，而是返回了 { price: 0, inStock: false, title: "Page Not Found" }。
 * 0 元进货价会让利润率算出天文数字，这种静默错误比抓不到危险得多。
 * 所以这里宁可抛错，也不放可疑值进测算模型。
 */
export function validateListing(raw: Partial<ScrapedListing> | null | undefined): ScrapedListing {
  if (!raw) throw new ScrapeRejected("抽取结果为空");

  const title = (raw.title ?? "").trim();
  if (!title) throw new ScrapeRejected("缺少商品标题");
  if (NOT_A_PRODUCT.test(title)) throw new ScrapeRejected(`不是有效商品页：${title.slice(0, 40)}`);

  const price = Number(raw.price);
  if (!Number.isFinite(price)) throw new ScrapeRejected("价格不是数字");
  if (price <= 0) throw new ScrapeRejected("价格为 0 或负数，判定为抓取失败而非免费商品");

  if (raw.inStock === false) throw new ScrapeRejected("商品无货，价格不可作为定价参考");

  return {
    title,
    price,
    currency: raw.currency ? String(raw.currency).toUpperCase().slice(0, 3) : null,
    inStock: raw.inStock ?? null,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
    reviewCount: Number.isFinite(Number(raw.reviewCount)) ? Number(raw.reviewCount) : null,
  };
}

/** 从搜索页 markdown 里提 ASIN。实测搜索页抓取正常但 schema 抽取会失败（正文 330KB 超限），正则更稳。 */
export function extractAsins(markdown: string, limit = 20): string[] {
  const seen = new Set<string>();
  for (const m of markdown.matchAll(/\/dp\/([A-Z0-9]{10})/g)) {
    seen.add(m[1]);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

function authHeaders(): Record<string, string> {
  const key = process.env.FIRECRAWL_API_KEY;
  // 注意：带一个无效 key 会 401，反而不如完全不带头走匿名
  return key ? { authorization: `Bearer ${key}` } : {};
}

export function createFirecrawlProvider(fetchImpl: typeof fetch = fetch) {
  async function post(body: unknown, timeoutMs: number) {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new ScrapeRejected(`Firecrawl 返回 ${res.status}`);
    return (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
  }

  return {
    name: process.env.FIRECRAWL_API_KEY ? "Firecrawl（配额账户）" : "Firecrawl（匿名）",

    /** 抓单个商品页并抽取结构化字段 */
    async scrapeListing(url: string): Promise<Sourced<ScrapedListing>> {
      const json = await post(
        { url, formats: [{ type: "json", schema: LISTING_SCHEMA }] },
        120_000,
      );
      const listing = validateListing(json.data?.json as Partial<ScrapedListing>);
      return { value: listing, source: `${this.name} ${new URL(url).hostname}`, fetchedAt: new Date(), fallback: false };
    },

    /** 抓任意页面的 markdown 正文，交给调用方自行解析 */
    async scrapeMarkdown(url: string): Promise<string> {
      const json = await post({ url, formats: ["markdown"], onlyMainContent: true }, 150_000);
      const md = String((json.data as { markdown?: string })?.markdown ?? "");
      if (!md) throw new ScrapeRejected("页面无正文");
      return md;
    },

    /** 抓搜索页，返回候选 ASIN */
    async searchAsins(marketplaceHost: string, keyword: string, limit = 20): Promise<Sourced<string[]>> {
      const url = `https://www.${marketplaceHost}/s?k=${encodeURIComponent(keyword)}`;
      const md = await this.scrapeMarkdown(url);
      return {
        value: extractAsins(md, limit),
        source: `${this.name} ${marketplaceHost} 搜索`,
        fetchedAt: new Date(),
        fallback: false,
      };
    },
  };
}
