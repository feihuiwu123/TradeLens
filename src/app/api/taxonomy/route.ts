import { z } from "zod";
import { loadCatalog } from "@/lib/catalog";
import { findSubcategory, gateSubcategory, allowedMethods, searchSubcategories, taxonomyTree } from "@/lib/taxonomy";
import { notFound, parseQuery, route } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  /** 传 slug 取单个子类目详情（含准入判定与可用物流） */
  sub: z.string().trim().min(1).optional(),
  /** 传 q 做关键词检索 */
  q: z.string().trim().max(60).optional(),
  /** 已持有的认证，逗号分隔。影响 block 级子类目是否放行 */
  certs: z.string().trim().max(300).optional(),
});

export const GET = route(async (request: Request) => {
  const parsed = parseQuery(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { sub, q, certs } = parsed.data;
  const heldCerts = certs ? certs.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const catalog = await loadCatalog();

  if (sub) {
    const s = findSubcategory(catalog, sub);
    if (!s) return notFound(`未收录子类目 ${sub}`);
    const gate = gateSubcategory(s, { heldCerts });
    return Response.json({
      slug: s.slug,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      hsCode: s.hsCode,
      altHsCodes: s.altHsCodes ? s.altHsCodes.split(",") : [],
      hsVerified: s.hsVerified === 1,
      typicalWeightKg: s.typicalWeightKg,
      typicalVolumeCbm: s.typicalVolumeCbm,
      logisticsFlag: s.logisticsFlag,
      allowedMethods: allowedMethods(s),
      gate,
    });
  }

  if (q) {
    return Response.json({
      query: q,
      items: searchSubcategories(catalog, q).map((s) => ({
        slug: s.slug,
        nameZh: s.nameZh,
        hsCode: s.hsCode,
        complianceLevel: s.complianceLevel,
        logisticsFlag: s.logisticsFlag,
      })),
    });
  }

  const tree = taxonomyTree(catalog);
  return Response.json({
    categoryCount: tree.length,
    subcategoryCount: tree.reduce((s, c) => s + c.subcategories.length, 0),
    blockedCount: catalog.subcategories.filter((s) => s.complianceLevel === "block").length,
    tree,
  });
});
