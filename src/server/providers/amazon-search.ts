import { AMAZON_DOMAIN } from "@/lib/marketplace-urls";
import { ScrapeRejected, createFirecrawlProvider } from "@/server/providers/firecrawl";
import type { Sourced } from "@/server/providers/types";

/**
 * 从 Amazon 搜索页解析真实在售商品。
 *
 * 为什么解析搜索页而不是逐个抓详情页：
 * 搜索页一次就能拿到几十个商品的 ASIN、标题、价格与评分（实测单页 54 个唯一 ASIN），
 * 等于「1 次调用换一个市场的价格样本」。逐个抓详情页是 1+N 次调用，慢且烧配额。
 *
 * 代价是搜索页的卡片结构不如详情页规整，约四成条目缺价格或标题——
 * 这些一律丢弃而不是猜测补全。宁可样本小，不可价格错。
 */

export type RealListing = {
  asin: string;
  title: string;
  /** 当地币种数值 */
  price: number;
  rating: number | null;
  reviewCount: number | null;
  /** 真实商品页链接，与 price 严格对应 */
  url: string;
};

/** markdown 里的价格可能是 $19.99、\$19.99、€21,90、￥2,480 */
function parsePrice(segment: string): number | null {
  // 先尝试带小数的规范写法
  const m =
    segment.match(/\\?[$€£¥￥]\s?([0-9][0-9., ]*[0-9])/) ??
    segment.match(/([0-9][0-9., ]*[0-9])\s?(?:円|EUR|USD|GBP)/);
  if (!m) return null;

  let raw = m[1].replace(/\s/g, "");
  // 欧式千分位：1.234,56 → 1234.56；英美式：1,234.56 → 1234.56
  if (/,\d{2}$/.test(raw)) raw = raw.replace(/\./g, "").replace(",", ".");
  else raw = raw.replace(/,/g, "");

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 把搜索页 markdown 切成每商品一块。
 *
 * 同一个 ASIN 会在图片链接、标题链接里重复出现，所以按「ASIN 首次出现位置」
 * 分块：每块从该 ASIN 首现处延伸到下一个不同 ASIN 的首现处，正好覆盖整张商品卡。
 */
export function parseSearchMarkdown(markdown: string, domain: string, limit = 20): RealListing[] {
  const firstIndex = new Map<string, number>();
  for (const m of markdown.matchAll(/\/dp\/([A-Z0-9]{10})/g)) {
    if (!firstIndex.has(m[1])) firstIndex.set(m[1], m.index ?? 0);
  }

  const ordered = [...firstIndex.entries()].sort((a, b) => a[1] - b[1]);
  const out: RealListing[] = [];

  for (let i = 0; i < ordered.length && out.length < limit; i++) {
    const [asin, start] = ordered[i];
    const end = ordered[i + 1]?.[1] ?? Math.min(start + 4000, markdown.length);
    const seg = markdown.slice(start, end).replace(/\n+/g, " ");

    const title =
      seg.match(/\[\*\*(.+?)\*\*\]/)?.[1]?.trim() ??
      seg.match(/\[([^\]]{15,200})\]/)?.[1]?.trim() ??
      null;
    const price = parsePrice(seg);

    // 缺标题或价格的条目直接丢弃——搜索页约四成条目不全，猜测补全等于编数据
    if (!title || price === null) continue;

    const rating = seg.match(/([0-9](?:\.[0-9])?)\s*out of 5/)?.[1];
    const reviews = seg.match(/\(?([0-9][0-9,]{2,})\)?\s*(?:ratings|reviews|条评论)/i)?.[1];

    out.push({
      asin,
      title: title.replace(/\s+/g, " ").slice(0, 200),
      price,
      rating: rating ? Number(rating) : null,
      reviewCount: reviews ? Number(reviews.replace(/,/g, "")) : null,
      url: `https://www.${domain}/dp/${asin}`,
    });
  }

  return out;
}

/** 价格中位数。用中位数而非均值——搜索结果里混着配件与高端品，均值会被离群值拉偏。 */
export function medianPrice(listings: RealListing[]): number | null {
  if (listings.length === 0) return null;
  const sorted = listings.map((l) => l.price).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type PriceStats = {
  median: number;
  min: number;
  max: number;
  count: number;
  /** max/min 倍数。跨度过大说明样本横跨白牌与品牌两个价格层 */
  spread: number;
  /** 样本是否混杂到不宜用单一中位数代表 */
  mixed: boolean;
};

/**
 * 样本离散度。
 *
 * 这是本模块最容易被忽视、后果最严重的一环：
 * 搜索「wireless earbuds」在美国站返回的是 $14~$25 的白牌，在澳洲站返回的却是
 * Anker / Samsung 这类 AUD 40~124 的品牌货。若直接拿两边中位数比价，会得出
 * 「澳洲净利率 58%」的结论——而实际上没人能用白牌成本卖出品牌售价。
 * 所以必须把跨度暴露出来，并在样本横跨价格层时明确标记。
 */
export function priceStats(listings: RealListing[]): PriceStats | null {
  const median = medianPrice(listings);
  if (median === null) return null;
  const prices = listings.map((l) => l.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = min > 0 ? max / min : Infinity;
  return { median, min, max, count: listings.length, spread, mixed: spread >= 4 };
}

/** 取某市场某关键词下的真实在售商品 */
export async function resolveMarketListings(
  market: string,
  keyword: string,
  limit = 12,
  fetchImpl?: typeof fetch,
): Promise<Sourced<RealListing[]>> {
  const domain = AMAZON_DOMAIN[market];
  if (!domain) throw new ScrapeRejected(`${market} 未配置 Amazon 站点域名`);

  const fc = createFirecrawlProvider(fetchImpl);
  const url = `https://www.${domain}/s?k=${encodeURIComponent(keyword)}`;
  const md = await fc.scrapeMarkdown(url);

  // 区分「站点拦截」与「解析失败」：实测 amazon.de 会返回 503「Tut uns Leid!」限流页，
  // 正文只有几百字节。把这种情况报成解析失败会让人以为是代码有问题。
  if (/tut uns leid|sorry|503|robot check|captcha|automated access/i.test(md.slice(0, 600))) {
    throw new ScrapeRejected(`${domain} 返回限流/拦截页，稍后重试`);
  }

  const listings = parseSearchMarkdown(md, domain, limit);
  if (listings.length === 0) {
    throw new ScrapeRejected(
      md.length < 2000
        ? `${domain} 只返回 ${md.length} 字节，疑似被拦截`
        : `${domain} 搜索页未解析出带价格的商品`,
    );
  }

  return {
    value: listings,
    source: `${fc.name} ${domain} 搜索「${keyword}」`,
    fetchedAt: new Date(),
    fallback: false,
  };
}
