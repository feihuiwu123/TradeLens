import { describe, expect, it } from "vitest";
import {
  allLinks,
  productLink,
  sellingLinks,
  sourcingLinks,
  url1688Offer,
  url1688Search,
  urlAmazonProduct,
  urlAmazonSearch,
} from "@/lib/marketplace-urls";

describe("链接构造", () => {
  it("中文关键词正确编码", () => {
    const u = url1688Search("蓝牙耳机");
    expect(u).toBe("https://s.1688.com/selloffer/offer_search.htm?keywords=%E8%93%9D%E7%89%99%E8%80%B3%E6%9C%BA");
    expect(decodeURIComponent(u)).toContain("蓝牙耳机");
  });

  it("Amazon 按站点生成不同域名", () => {
    expect(urlAmazonSearch("US", "earbuds")).toContain("amazon.com/s?k=");
    expect(urlAmazonSearch("DE", "earbuds")).toContain("amazon.de/s?k=");
    expect(urlAmazonSearch("JP", "earbuds")).toContain("amazon.co.jp/s?k=");
  });

  it("未收录的市场返回 null，不拼出一个不存在的域名", () => {
    expect(urlAmazonSearch("ZZ", "earbuds")).toBeNull();
    expect(urlAmazonProduct("ZZ", "B0CHWRXH8B")).toBeNull();
  });

  it("所有生成的 URL 都是合法的 https 绝对地址", () => {
    const links = [...allLinks("US", "蓝牙耳机"), ...allLinks("JP", "台灯"), ...allLinks("BR", "pet bowl")];
    expect(links.length).toBeGreaterThan(10);
    for (const l of links) {
      const u = new URL(l.url);
      expect(u.protocol, l.url).toBe("https:");
      expect(u.hostname, l.url).toMatch(/\./);
    }
  });

  it("关键词里的特殊字符不会破坏 URL", () => {
    for (const kw of ["a&b", "100% cotton", "c++ 书", "?q=x", "a/b"]) {
      for (const l of allLinks("US", kw)) {
        expect(() => new URL(l.url)).not.toThrow();
      }
    }
  });
});

describe("搜索链接与商品链接必须区分", () => {
  it("关键词链接一律标为 search", () => {
    for (const l of allLinks("US", "耳机")) expect(l.kind).toBe("search");
  });

  it("持有商品编号时才给 product 链接", () => {
    const l = productLink("Amazon", "US", "B0CHWRXH8B");
    expect(l?.kind).toBe("product");
    expect(l?.url).toBe("https://www.amazon.com/dp/B0CHWRXH8B");
  });

  it("拿不到编号对应的平台时返回 null，不退化成搜索链接冒充商品链接", () => {
    // 把搜索链接当成「这就是那个商品」展示会让用户以为价格来自该链接
    expect(productLink("TikTok Shop", "US", "12345")).toBeNull();
    expect(productLink("Noon", "AE", "12345")).toBeNull();
  });

  it("1688 offerId 生成详情页", () => {
    expect(url1688Offer("674404617087")).toBe("https://detail.1688.com/offer/674404617087.html");
  });

  it("平台名大小写与中文别名都能识别", () => {
    expect(productLink("amazon", "DE", "X")?.url).toContain("amazon.de");
    expect(productLink("京东", "US", "100012043978")?.url).toContain("item.jd.com");
    expect(productLink("速卖通", "US", "1005006315201234")?.url).toContain("aliexpress.com/item");
  });
});

describe("平台按市场过滤", () => {
  it("只给该市场真实存在的平台", () => {
    // 给日本用户 Mercado Libre 链接毫无意义
    const jp = sellingLinks("JP", "台灯").map((l) => l.platform);
    expect(jp).toContain("Amazon");
    expect(jp).toContain("Rakuten");
    expect(jp).not.toContain("Mercado Libre");
    expect(jp).not.toContain("Walmart");
  });

  it("墨西哥与巴西给美客多", () => {
    expect(sellingLinks("MX", "x").map((l) => l.platform)).toContain("Mercado Libre");
    expect(sellingLinks("BR", "x").map((l) => l.platform)).toContain("Mercado Libre");
  });

  it("新加坡与巴西给虾皮", () => {
    expect(sellingLinks("SG", "x").map((l) => l.platform)).toContain("Shopee");
    expect(sellingLinks("BR", "x").map((l) => l.platform)).toContain("Shopee");
  });

  it("韩国只有 Coupang，没有 Amazon 站点", () => {
    const kr = sellingLinks("KR", "x").map((l) => l.platform);
    expect(kr).toContain("Coupang");
    expect(kr).not.toContain("Amazon");
  });

  it("采购侧恒定给 1688 / 速卖通 / 淘宝 / 京东", () => {
    expect(sourcingLinks("耳机").map((l) => l.platform)).toEqual(["1688", "AliExpress", "Taobao", "JD"]);
    expect(sourcingLinks("耳机").every((l) => l.side === "sourcing")).toBe(true);
  });

  it("Noon 标记为未验证——本机不可达，不能谎称已验证", () => {
    const noon = sellingLinks("AE", "x").find((l) => l.platform === "Noon");
    expect(noon?.verified).toBe(false);
  });
});
