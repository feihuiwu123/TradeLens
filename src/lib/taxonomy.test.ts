import { describe, expect, it } from "vitest";
import {
  allowedMethods,
  findSubcategory,
  gateSubcategory,
  searchSubcategories,
  taxonomyTree,
} from "@/lib/taxonomy";
import { subcategorySeed } from "@/lib/taxonomy-seed";
import { buildSeedCatalog } from "@/server/store/seed-catalog";

const catalog = buildSeedCatalog();
const sub = (slug: string) => {
  const s = findSubcategory(catalog, slug);
  if (!s) throw new Error(`缺少子类目 ${slug}`);
  return s;
};

describe("taxonomy 落库完整性", () => {
  it("34 个子类目全部落库", () => {
    expect(catalog.subcategories).toHaveLength(34);
    expect(subcategorySeed).toHaveLength(34);
  });

  it("slug 唯一", () => {
    const slugs = catalog.subcategories.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("每个子类目都挂在真实类目上", () => {
    const ids = new Set(catalog.categories.map((c) => c.id));
    for (const s of catalog.subcategories) expect(ids.has(s.categoryId)).toBe(true);
  });

  it("每个类目至少有一个子类目——不能有空类目出现在级联选择里", () => {
    for (const c of catalog.categories) {
      expect(catalog.subcategories.filter((s) => s.categoryId === c.id).length).toBeGreaterThan(0);
    }
  });

  it("HS 编码为 4 位或 6 位格式", () => {
    for (const s of catalog.subcategories) {
      expect(s.hsCode, s.slug).toMatch(/^\d{4}(\.\d{2})?$/);
    }
  });

  it("所有 HS 编码初始标记为未校验——未经官方税则库核对的编码只能当起点", () => {
    for (const s of catalog.subcategories) expect(s.hsVerified).toBe(0);
  });

  it("典型重量体积为正数，否则测算器预填会算出除零", () => {
    for (const s of catalog.subcategories) {
      expect(s.typicalWeightKg, s.slug).toBeGreaterThan(0);
      expect(s.typicalVolumeCbm, s.slug).toBeGreaterThan(0);
    }
  });

  it("block 级子类目必须写明所需证书，否则无法判定放行条件", () => {
    for (const s of catalog.subcategories.filter((x) => x.complianceLevel === "block")) {
      expect(s.requiredCerts.trim(), s.slug).not.toBe("");
    }
  });
});

describe("合规拦截", () => {
  it("母婴早教无证书时禁止进入候选池", () => {
    const v = gateSubcategory(sub("baby-educational"));
    expect(v.allowed).toBe(false);
    expect(v.level).toBe("block");
    expect(v.blockedReason).toContain("禁止备货");
    expect(v.requiredCerts.join()).toMatch(/CPC/);
  });

  it("三个母婴子类目全部是硬拦截", () => {
    for (const slug of ["baby-feeding", "baby-educational", "baby-safety"]) {
      expect(gateSubcategory(sub(slug)).allowed, slug).toBe(false);
    }
  });

  it("提供对应证书后放行，但降级为 warn 而非 ok", () => {
    const v = gateSubcategory(sub("baby-educational"), { heldCerts: ["CPC"] });
    expect(v.allowed).toBe(true);
    expect(v.level).toBe("warn");
    expect(v.blockedReason).toBeNull();
  });

  it("做单一市场只需覆盖该市场证书，不必全集齐", () => {
    // 只做欧洲，持 EN71 即可，不必有美国 CPC
    expect(gateSubcategory(sub("baby-educational"), { heldCerts: ["EN71"] }).allowed).toBe(true);
  });

  it("无关证书不能解锁", () => {
    expect(gateSubcategory(sub("baby-educational"), { heldCerts: ["FCC"] }).allowed).toBe(false);
  });

  it("warn 级子类目直接放行但带警示", () => {
    const v = gateSubcategory(sub("3c-audio"));
    expect(v.allowed).toBe(true);
    expect(v.level).toBe("warn");
    expect(v.requiredCerts.join()).toMatch(/UN38\.3/);
  });

  it("ok 级子类目无需证书", () => {
    const v = gateSubcategory(sub("3c-phone-acc"));
    expect(v.allowed).toBe(true);
    expect(v.level).toBe("ok");
  });
});

describe("物流约束", () => {
  it("重货不给快递与空运选项——那是注定亏损的方案", () => {
    expect(allowedMethods(sub("fitness-strength"))).toEqual(["sea_lcl", "sea_fcl"]);
    expect(allowedMethods(sub("outdoor-gear"))).not.toContain("express");
  });

  it("抛货禁走快递", () => {
    const m = allowedMethods(sub("fitness-yoga"));
    expect(m).not.toContain("express");
    expect(m).toContain("sea_lcl");
  });

  it("带电池优先海运但保留快递", () => {
    const m = allowedMethods(sub("3c-audio"));
    expect(m[0]).toBe("sea_lcl");
    expect(m).toContain("express");
  });

  it("普通件四种方式全开", () => {
    expect(allowedMethods(sub("3c-phone-acc"))).toHaveLength(4);
  });

  it("瑜伽垫与哑铃都被标了物流红线", () => {
    expect(sub("fitness-yoga").logisticsFlag).toBe("volumetric");
    expect(sub("fitness-strength").logisticsFlag).toBe("heavy");
  });

  it("警示文案包含物流原因", () => {
    expect(gateSubcategory(sub("fitness-yoga")).warnings.join()).toMatch(/抛货|体积重/);
    expect(gateSubcategory(sub("fitness-strength")).warnings.join()).toMatch(/重货|海运/);
  });
});

describe("子类目检索", () => {
  it("中文品类词命中", () => {
    expect(searchSubcategories(catalog, "耳机").map((s) => s.slug)).toContain("3c-audio");
    expect(searchSubcategories(catalog, "瑜伽垫").map((s) => s.slug)).toContain("fitness-yoga");
  });

  it("英文命中", () => {
    expect(searchSubcategories(catalog, "earbuds").map((s) => s.slug)).toContain("3c-audio");
    expect(searchSubcategories(catalog, "yoga").map((s) => s.slug)).toContain("fitness-yoga");
  });

  it("HS 编码命中", () => {
    expect(searchSubcategories(catalog, "8518.30").map((s) => s.slug)).toContain("3c-audio");
  });

  it("用户输入的词比关键词表更长也能命中", () => {
    // 表里是「耳机」，用户输入「无线蓝牙耳机」
    expect(searchSubcategories(catalog, "无线蓝牙耳机").map((s) => s.slug)).toContain("3c-audio");
  });

  it("空查询返回空，不返回全表", () => {
    expect(searchSubcategories(catalog, "")).toEqual([]);
    expect(searchSubcategories(catalog, "   ")).toEqual([]);
  });

  it("受 limit 约束", () => {
    expect(searchSubcategories(catalog, "a", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("级联树", () => {
  it("返回 10 个类目且都带子类目", () => {
    const tree = taxonomyTree(catalog);
    expect(tree).toHaveLength(10);
    expect(tree.every((c) => c.subcategories.length > 0)).toBe(true);
    expect(tree.reduce((s, c) => s + c.subcategories.length, 0)).toBe(34);
  });

  it("暴露 hsVerified 供 UI 提示编码未经校验", () => {
    const tree = taxonomyTree(catalog);
    expect(tree[0].subcategories[0].hsVerified).toBe(false);
  });
});
