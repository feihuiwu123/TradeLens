import { describe, expect, it } from "vitest";
import { ScrapeRejected, extractAsins, validateListing } from "@/server/providers/firecrawl";

describe("抓取结果校验闸门", () => {
  it("正常商品页通过", () => {
    const l = validateListing({
      title: "Apple AirPods Pro (2nd Generation)",
      price: 263.86,
      currency: "usd",
      inStock: true,
      rating: 4.7,
      reviewCount: 28770,
    });
    expect(l.price).toBe(263.86);
    expect(l.currency).toBe("USD");
    expect(l.reviewCount).toBe(28770);
  });

  it("拒绝 404 页伪造出的 0 元价格", () => {
    // 这是实测遇到的真实故障：抓 amazon.de 上不存在的 ASIN，
    // 抽取模型返回了 { title: "Page Not Found", price: 0, inStock: false }。
    // 放进模型会算出天文数字的利润率。
    expect(() => validateListing({ title: "Page Not Found", price: 0, inStock: false })).toThrow(
      ScrapeRejected,
    );
  });

  it("标题命中非商品页特征即拒绝，哪怕价格看起来正常", () => {
    for (const t of ["Page Not Found", "404 Not Found", "Robot Check", "Sorry! Something went wrong"]) {
      expect(() => validateListing({ title: t, price: 99 })).toThrow(/不是有效商品页/);
    }
  });

  it("价格为 0 或负数一律判为抓取失败，而不是免费商品", () => {
    expect(() => validateListing({ title: "正常商品", price: 0 })).toThrow(/抓取失败/);
    expect(() => validateListing({ title: "正常商品", price: -5 })).toThrow(/抓取失败/);
  });

  it("价格不是数字时拒绝", () => {
    expect(() => validateListing({ title: "正常商品", price: NaN })).toThrow(/不是数字/);
    expect(() => validateListing({ title: "正常商品" })).toThrow(/不是数字/);
  });

  it("无货商品拒绝——无货页的挂牌价不能当定价参考", () => {
    expect(() => validateListing({ title: "正常商品", price: 50, inStock: false })).toThrow(/无货/);
  });

  it("缺标题或空结果拒绝", () => {
    expect(() => validateListing({ price: 50 })).toThrow(/标题/);
    expect(() => validateListing(null)).toThrow(/为空/);
  });

  it("可选字段缺失时降级为 null，不编造", () => {
    const l = validateListing({ title: "正常商品", price: 12.5 });
    expect(l.currency).toBeNull();
    expect(l.rating).toBeNull();
    expect(l.reviewCount).toBeNull();
    expect(l.inStock).toBeNull();
  });
});

describe("搜索页 ASIN 提取", () => {
  it("从 markdown 里提取并去重", () => {
    const md = `
      [商品A](https://www.amazon.com/dp/B0CHWRXH8B/ref=sr_1_1)
      [商品B](https://www.amazon.com/dp/B09B8V1LZ3)
      [商品A 重复](https://www.amazon.com/dp/B0CHWRXH8B)
    `;
    expect(extractAsins(md)).toEqual(["B0CHWRXH8B", "B09B8V1LZ3"]);
  });

  it("受 limit 约束——搜索页实测有 137 个链接，不设上限会把配额打爆", () => {
    const md = Array.from({ length: 50 }, (_, i) => `/dp/B${String(i).padStart(9, "0")}`).join(" ");
    expect(extractAsins(md, 5)).toHaveLength(5);
  });

  it("无匹配返回空数组", () => {
    expect(extractAsins("没有任何商品链接")).toEqual([]);
  });

  it("只认 10 位 ASIN 格式", () => {
    expect(extractAsins("/dp/TOOSHORT /dp/B0CHWRXH8B")).toEqual(["B0CHWRXH8B"]);
  });
});
