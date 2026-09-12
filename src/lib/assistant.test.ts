import { describe, expect, it } from "vitest";
import { matchProduct } from "@/lib/assistant";

const products = [
  { sku: "TD-EB-001", nameZh: "私模半入耳蓝牙耳机", nameEn: "Private-mold TWS earbuds" },
  { sku: "TD-PET-051", nameZh: "五指宠物洗澡手套", nameEn: "Pet bathing glove" },
  { sku: "TD-LAMP-019", nameZh: "护眼折叠台灯", nameEn: "Folding desk lamp" },
  { sku: "TD-YG-011", nameZh: "TPE 双色瑜伽垫", nameEn: "TPE yoga mat" },
];

describe("商品模糊匹配", () => {
  it("用户只说品类通名也要能命中完整品名", () => {
    // 这是修复前失效的核心场景：判断方向反了，要求提问包含完整品名
    expect(matchProduct("耳机", products)?.sku).toBe("TD-EB-001");
    expect(matchProduct("耳机卖美国怎么样", products)?.sku).toBe("TD-EB-001");
    expect(matchProduct("蓝牙耳机利润", products)?.sku).toBe("TD-EB-001");
  });

  it("匹配更长的商品优先", () => {
    // 「手套」比「宠物」更贴近，但都指向同一款；确保不会被别的商品截胡
    expect(matchProduct("洗澡手套能做吗", products)?.sku).toBe("TD-PET-051");
    expect(matchProduct("瑜伽垫该海运还是快递", products)?.sku).toBe("TD-YG-011");
  });

  it("SKU 与英文名走精确匹配", () => {
    expect(matchProduct("td-eb-001 的利润", products)?.sku).toBe("TD-EB-001");
    expect(matchProduct("how about TPE yoga mat", products)?.sku).toBe("TD-YG-011");
  });

  it("与任何品名都不沾边时不硬凑", () => {
    expect(matchProduct("如何把接口给 Hermes", products)).toBeUndefined();
    expect(matchProduct("美国关税怎么算", products)).toBeUndefined();
    expect(matchProduct("现在做什么品最赚钱", products)).toBeUndefined();
  });

  it("单字重合不算命中（避免误伤通用问句）", () => {
    // 「台」单字与「护眼折叠台灯」重合，但不足以判定用户在问台灯
    expect(matchProduct("台", products)).toBeUndefined();
  });

  it("空输入不炸", () => {
    expect(matchProduct("", products)).toBeUndefined();
    expect(matchProduct("耳机", [])).toBeUndefined();
  });
});
