/**
 * 各电商平台的真实链接构造。
 *
 * 严格区分两类链接，不可混淆：
 * - search：关键词搜索页。恒定有效，但指向的是一堆商品，不是某个具体商品。
 * - product：具体商品详情页。只有在确实持有该平台的商品编号时才能生成。
 *
 * 本仓的种子商品是合成数据（TD-EB-001 之类），没有对应的真实 listing，
 * 所以只能给 search 链接。把 search 链接当成「这就是那个商品」展示，
 * 等于让用户以为看到的价格来自那个链接——这是必须避免的误导。
 *
 * 所有模式均以真实请求验证过（403 为反爬拦截，不代表模式错误）。
 */

export type LinkKind = "search" | "product";

export type MarketplaceLink = {
  platform: string;
  /** 展示用短名 */
  label: string;
  url: string;
  kind: LinkKind;
  /** 中国采购端 / 海外销售端 */
  side: "sourcing" | "selling";
  /** 该模式是否已实测可达 */
  verified: boolean;
};

const enc = encodeURIComponent;

/** Amazon 各站域名。ASIN 分站点，不可跨站复用。 */
export const AMAZON_DOMAIN: Record<string, string> = {
  US: "amazon.com",
  CA: "amazon.ca",
  UK: "amazon.co.uk",
  DE: "amazon.de",
  FR: "amazon.fr",
  JP: "amazon.co.jp",
  AU: "amazon.com.au",
  SG: "amazon.sg",
  AE: "amazon.ae",
  MX: "amazon.com.mx",
  BR: "amazon.com.br",
};

const EBAY_DOMAIN: Record<string, string> = {
  US: "ebay.com",
  CA: "ebay.ca",
  UK: "ebay.co.uk",
  DE: "ebay.de",
  AU: "ebay.com.au",
  FR: "ebay.fr",
};

const SHOPEE_DOMAIN: Record<string, string> = {
  SG: "shopee.sg",
  BR: "shopee.com.br",
  MX: "shopee.com.mx",
};

const MERCADO_DOMAIN: Record<string, string> = {
  MX: "listado.mercadolibre.com.mx",
  BR: "lista.mercadolivre.com.br",
};

// ── 中国采购端 ──────────────────────────────────────────────

/** 1688 搜索。跨境采购主渠道。 */
export function url1688Search(keyword: string) {
  return `https://s.1688.com/selloffer/offer_search.htm?keywords=${enc(keyword)}`;
}

/** 1688 商品详情，需 offerId */
export function url1688Offer(offerId: string) {
  return `https://detail.1688.com/offer/${enc(offerId)}.html`;
}

export function urlTaobaoSearch(keyword: string) {
  return `https://s.taobao.com/search?q=${enc(keyword)}`;
}

export function urlJdSearch(keyword: string) {
  return `https://search.jd.com/Search?keyword=${enc(keyword)}`;
}

/** 速卖通。既是采购渠道也是海外销售渠道，这里归采购侧（看同行报价）。 */
export function urlAliExpressSearch(keyword: string) {
  return `https://www.aliexpress.com/w/wholesale-${enc(keyword).replace(/%20/g, "-")}.html`;
}

export function urlAliExpressItem(itemId: string) {
  return `https://www.aliexpress.com/item/${enc(itemId)}.html`;
}

/** 中国采购端全部链接 */
export function sourcingLinks(keyword: string): MarketplaceLink[] {
  return [
    { platform: "1688", label: "1688", url: url1688Search(keyword), kind: "search", side: "sourcing", verified: true },
    { platform: "AliExpress", label: "速卖通", url: urlAliExpressSearch(keyword), kind: "search", side: "sourcing", verified: true },
    { platform: "Taobao", label: "淘宝", url: urlTaobaoSearch(keyword), kind: "search", side: "sourcing", verified: true },
    { platform: "JD", label: "京东", url: urlJdSearch(keyword), kind: "search", side: "sourcing", verified: true },
  ];
}

// ── 海外销售端 ──────────────────────────────────────────────

export function urlAmazonSearch(market: string, keyword: string) {
  const domain = AMAZON_DOMAIN[market];
  return domain ? `https://www.${domain}/s?k=${enc(keyword)}` : null;
}

/** Amazon 商品页。ASIN 必须来自对应站点，跨站会 404。 */
export function urlAmazonProduct(market: string, asin: string) {
  const domain = AMAZON_DOMAIN[market];
  return domain ? `https://www.${domain}/dp/${enc(asin)}` : null;
}

/**
 * 某个目标市场的全部可点链接。
 * 只返回该市场真实存在的平台——给日本用户一个 Mercado Libre 链接毫无意义。
 */
export function sellingLinks(market: string, keyword: string): MarketplaceLink[] {
  const out: MarketplaceLink[] = [];
  const push = (platform: string, label: string, url: string | null, verified = true) => {
    if (url) out.push({ platform, label, url, kind: "search", side: "selling", verified });
  };

  push("Amazon", "亚马逊", urlAmazonSearch(market, keyword));

  if (EBAY_DOMAIN[market]) {
    push("eBay", "eBay", `https://www.${EBAY_DOMAIN[market]}/sch/i.html?_nkw=${enc(keyword)}`);
  }
  if (SHOPEE_DOMAIN[market]) {
    push("Shopee", "虾皮", `https://${SHOPEE_DOMAIN[market]}/search?keyword=${enc(keyword)}`);
  }
  if (MERCADO_DOMAIN[market]) {
    push("Mercado Libre", "美客多", `https://${MERCADO_DOMAIN[market]}/${enc(keyword)}`);
  }
  if (market === "US" || market === "CA") {
    push("Walmart", "沃尔玛", `https://www.walmart.com/search?q=${enc(keyword)}`);
  }
  if (market === "JP") {
    push("Rakuten", "乐天", `https://search.rakuten.co.jp/search/mall/${enc(keyword)}/`);
  }
  if (market === "KR") {
    push("Coupang", "Coupang", `https://www.coupang.com/np/search?q=${enc(keyword)}`);
  }
  if (market === "AE") {
    // 从本机不可达（连根域都超时），保留模式但标记未验证
    push("Noon", "Noon", `https://www.noon.com/uae-en/search/?q=${enc(keyword)}`, false);
  }
  if (["US", "UK", "DE", "MX", "BR"].includes(market)) {
    push("Temu", "Temu", `https://www.temu.com/search_result.html?search_key=${enc(keyword)}`);
  }

  return out;
}

/** 采购 + 销售两侧全部链接 */
export function allLinks(market: string, keyword: string): MarketplaceLink[] {
  return [...sourcingLinks(keyword), ...sellingLinks(market, keyword)];
}

/**
 * 已知商品编号时生成精确商品链接。
 * 拿不到对应平台的编号就返回 null——绝不退化成搜索链接冒充商品链接。
 */
export function productLink(platform: string, market: string, id: string): MarketplaceLink | null {
  const p = platform.toLowerCase();
  if (p.includes("amazon")) {
    const url = urlAmazonProduct(market, id);
    return url ? { platform: "Amazon", label: "亚马逊", url, kind: "product", side: "selling", verified: true } : null;
  }
  if (p === "1688") {
    return { platform: "1688", label: "1688", url: url1688Offer(id), kind: "product", side: "sourcing", verified: true };
  }
  if (p.includes("aliexpress") || p.includes("速卖通")) {
    return {
      platform: "AliExpress",
      label: "速卖通",
      url: urlAliExpressItem(id),
      kind: "product",
      side: "sourcing",
      verified: true,
    };
  }
  if (p === "jd" || p.includes("京东")) {
    return { platform: "JD", label: "京东", url: `https://item.jd.com/${enc(id)}.html`, kind: "product", side: "sourcing", verified: true };
  }
  if (p.includes("taobao") || p.includes("淘宝")) {
    return { platform: "Taobao", label: "淘宝", url: `https://item.taobao.com/item.htm?id=${enc(id)}`, kind: "product", side: "sourcing", verified: true };
  }
  if (p.includes("ebay")) {
    return { platform: "eBay", label: "eBay", url: `https://www.ebay.com/itm/${enc(id)}`, kind: "product", side: "selling", verified: true };
  }
  return null;
}
