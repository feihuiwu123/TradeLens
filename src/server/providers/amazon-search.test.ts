import { describe, expect, it } from "vitest";
import { medianPrice, parseSearchMarkdown, priceStats, type RealListing } from "@/server/providers/amazon-search";

/** 按实测的 Amazon 搜索页 markdown 结构构造，含重复 ASIN 与不完整卡片 */
const MD = `
![](https://m.media-amazon.com/images/x.png)
[](/dp/B0HCXW6CDR/ref=sr_1_1?dib=abc&sr=8-1)
[![img](https://m.media-amazon.com/i/1.jpg)](/dp/B0HCXW6CDR/ref=sr_1_1)
[**XIAOWTEK Wireless Earbuds, Bluetooth 5.4 Headphones**](/dp/B0HCXW6CDR)
4.9 out of 5 stars (1,284) ratings
$19.99
[](/dp/B0HC5TSR81/ref=sr_1_2)
[**HAOYUYAN Wireless Earbuds, Sports Bluetooth**](/dp/B0HC5TSR81)
4.7 out of 5 stars
$23.98
[](/dp/B0FQFB8FMG/ref=sr_1_3)
[**Apple AirPods Pro 3 Wireless Earbuds**](/dp/B0FQFB8FMG)
4.4 out of 5 stars
$199.00
[](/dp/B0DW9CJG18/ref=sr_1_4)
[](/dp/B0DN4BG1RW/ref=sr_1_5)
`;

describe("搜索页解析", () => {
  const rows = parseSearchMarkdown(MD, "amazon.com");

  it("同一 ASIN 重复出现只产出一条", () => {
    const asins = rows.map((r) => r.asin);
    expect(new Set(asins).size).toBe(asins.length);
    expect(asins.filter((a) => a === "B0HCXW6CDR")).toHaveLength(1);
  });

  it("解析出标题、价格、评分与真实链接", () => {
    const first = rows[0];
    expect(first.asin).toBe("B0HCXW6CDR");
    expect(first.title).toContain("XIAOWTEK");
    expect(first.price).toBe(19.99);
    expect(first.rating).toBe(4.9);
    expect(first.reviewCount).toBe(1284);
    expect(first.url).toBe("https://www.amazon.com/dp/B0HCXW6CDR");
  });

  it("缺价格或标题的卡片被丢弃而不是猜测补全", () => {
    // 实测搜索页约四成条目不全，猜测补全等于编数据
    const asins = rows.map((r) => r.asin);
    expect(asins).not.toContain("B0DW9CJG18");
    expect(asins).not.toContain("B0DN4BG1RW");
    expect(rows).toHaveLength(3);
  });

  it("链接域名跟随目标站点", () => {
    const de = parseSearchMarkdown(MD, "amazon.de");
    expect(de[0].url).toBe("https://www.amazon.de/dp/B0HCXW6CDR");
  });

  it("受 limit 约束", () => {
    expect(parseSearchMarkdown(MD, "amazon.com", 2)).toHaveLength(2);
  });

  it("空输入返回空数组而不是抛错", () => {
    expect(parseSearchMarkdown("", "amazon.com")).toEqual([]);
    expect(parseSearchMarkdown("没有任何商品", "amazon.com")).toEqual([]);
  });
});

describe("价格格式", () => {
  const price = (seg: string) =>
    parseSearchMarkdown(`[](/dp/AAAAAAAAAA)[**T**](/dp/AAAAAAAAAA) ${seg}`, "amazon.com")[0]?.price ?? null;

  it("美式千分位", () => {
    expect(price("$1,234.56")).toBe(1234.56);
  });

  it("欧式千分位：逗号是小数点", () => {
    // 21,90 € 是 21.9 欧，不是 2190 欧——搞错等于把利润放大百倍
    expect(price("€21,90")).toBe(21.9);
    expect(price("€1.234,56")).toBe(1234.56);
  });

  it("日元无小数", () => {
    expect(price("¥6980")).toBe(6980);
    expect(price("￥2,480")).toBe(2480);
  });

  it("markdown 转义的美元符号", () => {
    expect(price("\\$19.99")).toBe(19.99);
  });

  it("没有价格返回 null，条目被丢弃", () => {
    expect(price("无价格")).toBeNull();
  });

  it("零或负价格不被采纳", () => {
    expect(price("$0.00")).toBeNull();
  });
});

describe("代表价取中位数", () => {
  const mk = (prices: number[]): RealListing[] =>
    prices.map((p, i) => ({ asin: `A${i}`, title: "t", price: p, rating: null, reviewCount: null, url: "u" }));

  it("奇数个取中间", () => {
    expect(medianPrice(mk([10, 20, 30]))).toBe(20);
  });

  it("偶数个取中间两个的均值", () => {
    expect(medianPrice(mk([10, 20, 30, 40]))).toBe(25);
  });

  it("离群值不会像均值那样拉偏结果", () => {
    // 搜索结果里混着 $199 的 AirPods 与 $19 的白牌，均值会失真
    const withOutlier = mk([19, 20, 21, 22, 199]);
    expect(medianPrice(withOutlier)).toBe(21);
    const mean = [19, 20, 21, 22, 199].reduce((a, b) => a + b) / 5;
    expect(mean).toBeGreaterThan(50);
  });

  it("空数组返回 null", () => {
    expect(medianPrice([])).toBeNull();
  });
});

describe("样本离散度", () => {
  const mk = (prices: number[]): RealListing[] =>
    prices.map((p, i) => ({ asin: `A${i}`, title: "t", price: p, rating: null, reviewCount: null, url: "u" }));

  it("白牌集中的样本不触发混杂标记", () => {
    // 美国站实测 $13.99~$24.99，跨度 1.8 倍
    const s = priceStats(mk([13.99, 19.97, 19.99, 23.98, 24.99]))!;
    expect(s.spread).toBeLessThan(4);
    expect(s.mixed).toBe(false);
  });

  it("白牌混品牌的样本被标记为不可用单一中位数代表", () => {
    // 澳洲站实测 AUD 40.46~124.44，跨度 3.1 倍；再混入更便宜的配件就会超 4 倍
    const s = priceStats(mk([20, 40.46, 74.38, 94.11, 124.44]))!;
    expect(s.spread).toBeGreaterThanOrEqual(4);
    expect(s.mixed).toBe(true);
  });

  it("暴露区间而不只给中位数", () => {
    const s = priceStats(mk([10, 20, 30]))!;
    expect(s.min).toBe(10);
    expect(s.max).toBe(30);
    expect(s.median).toBe(20);
    expect(s.count).toBe(3);
  });

  it("空样本返回 null", () => {
    expect(priceStats([])).toBeNull();
  });
});
