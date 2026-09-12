import type { Subcategory } from "@/db/schema";
import type { Catalog } from "@/server/store/types";
import type { ShippingMethod } from "@/lib/types";

/**
 * 子类目准入与物流约束。
 *
 * 这是 taxonomy 落库的真正价值——不只是一棵分类树，而是把「什么不能做」
 * 编成可执行规则。合规风险比利润率更致命：无 CPC 的儿童玩具不是利润薄，
 * 是货被扣、店被封、资金被冻结。
 */

export type GateVerdict = {
  /** false 表示禁止进入候选池，不是提示 */
  allowed: boolean;
  level: "ok" | "warn" | "block";
  /** 阻断原因（level=block 时非空） */
  blockedReason: string | null;
  warnings: string[];
  requiredCerts: string[];
};

/**
 * 判断子类目能否进入候选池。
 *
 * block 级必须提供已持有的证书才放行。传 heldCerts 时按「是否覆盖任一必需证书」判定——
 * 各国证书体系不同（美 CPC、欧 EN71、日 ST），做单一市场不必全集齐。
 */
export function gateSubcategory(
  sub: Subcategory,
  opts: { heldCerts?: string[] } = {},
): GateVerdict {
  const required = sub.requiredCerts
    .split(/[,/;，、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const held = (opts.heldCerts ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  const hasAnyRequired =
    required.length === 0 ||
    required.some((r) => held.some((h) => r.toLowerCase().includes(h) || h.includes(r.toLowerCase())));

  const warnings: string[] = [];
  if (sub.logisticsFlag === "volumetric") {
    warnings.push("抛货：体积重远大于实重，快递路径会吃掉差价，建议海运备货");
  }
  if (sub.logisticsFlag === "heavy") {
    warnings.push("重货：仅海运可行，需另算尾程大件派送附加费");
  }
  if (sub.logisticsFlag === "battery") {
    warnings.push("含电池：空运受限，需 UN38.3 与 MSDS，部分专线拒收");
  }
  if (sub.note) warnings.push(sub.note);

  if (sub.complianceLevel === "block" && !hasAnyRequired) {
    return {
      allowed: false,
      level: "block",
      blockedReason: `该子类目属强制认证品类，未提供以下任一证书前禁止备货：${required.join(" / ")}`,
      warnings,
      requiredCerts: required,
    };
  }

  return {
    allowed: true,
    level: sub.complianceLevel === "block" ? "warn" : (sub.complianceLevel as "ok" | "warn"),
    blockedReason: null,
    warnings,
    requiredCerts: required,
  };
}

/** 该子类目允许的物流方式。抛货与重货不给快递报价，避免给出注定亏损的方案。 */
export function allowedMethods(sub: Subcategory): ShippingMethod[] {
  switch (sub.logisticsFlag) {
    case "heavy":
      return ["sea_lcl", "sea_fcl"];
    case "volumetric":
      return ["air", "sea_lcl", "sea_fcl"];
    case "battery":
      // 带电可走快递/专线，但海运更稳妥，顺序即推荐优先级
      return ["sea_lcl", "air", "express"];
    default:
      return ["express", "air", "sea_lcl", "sea_fcl"];
  }
}

/** 按关键词模糊检索子类目。中文无词边界，用关键词表而不是纯品名匹配。 */
export function searchSubcategories(catalog: Catalog, query: string, limit = 10): Subcategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = catalog.subcategories
    .map((s) => {
      const haystack = `${s.nameZh} ${s.nameEn} ${s.slug} ${s.keywords} ${s.hsCode}`.toLowerCase();
      if (haystack.includes(q)) return { s, score: 2 };
      // 关键词表里任一条命中查询串，也算（用户输入「无线耳机」，表里是「蓝牙耳机」）
      const kws = s.keywords.toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);
      if (kws.some((k) => k && (q.includes(k) || k.includes(q)))) return { s, score: 1 };
      return null;
    })
    .filter((x): x is { s: Subcategory; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.s);
}

/** 类目 → 子类目树，供 UI 级联选择 */
export function taxonomyTree(catalog: Catalog) {
  return catalog.categories.map((c) => ({
    slug: c.slug,
    nameZh: c.nameZh,
    hsChapter: c.hsChapter,
    subcategories: catalog.subcategories
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({
        slug: s.slug,
        nameZh: s.nameZh,
        hsCode: s.hsCode,
        hsVerified: s.hsVerified === 1,
        typicalWeightKg: s.typicalWeightKg,
        typicalVolumeCbm: s.typicalVolumeCbm,
        logisticsFlag: s.logisticsFlag,
        complianceLevel: s.complianceLevel,
        requiredCerts: s.requiredCerts,
        note: s.note,
      })),
  }));
}

export function findSubcategory(catalog: Catalog, slug: string): Subcategory | undefined {
  return catalog.subcategories.find((s) => s.slug === slug);
}
