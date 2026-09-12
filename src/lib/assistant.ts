import { buildOpportunities, loadCatalog, type Catalog } from "@/lib/catalog";
import { money, pct } from "@/lib/format";
import { calculateProfit } from "@/lib/profit";
import type { Opportunity } from "@/lib/types";

export const HERMES_TOOLS = [
  {
    name: "scan_opportunities",
    description: "扫描中国货源到目标国家的差价机会，已计入运费、关税、平台费、广告与退货。",
    method: "GET",
    path: "/api/opportunities",
    parameters: {
      market: "国家代码，如 US DE JP AU MX",
      category: "类目 slug，如 pet fitness 3c-accessories",
      minMargin: "最低毛利率百分比",
      method: "express | air | sea_lcl | sea_fcl | auto",
    },
  },
  {
    name: "calculate_profit",
    description: "按货源价、售价、重量体积、目标国、物流方式计算全成本利润。",
    method: "POST",
    path: "/api/calculator",
    parameters: {
      sku: "产品 SKU，可选",
      market: "目标市场代码",
      shippingMethod: "物流方式",
      quantity: "件数",
      adsRate: "广告占比 0-1",
      returnRate: "退货率 0-1",
    },
  },
  {
    name: "lookup_customs",
    description: "按 HS 编码查询各国最惠国税率、附加税与增值税。",
    method: "GET",
    path: "/api/customs",
    parameters: { hs: "HS 编码，如 8518.30", market: "可选国家代码" },
  },
  {
    name: "estimate_shipping",
    description: "估算中国发往目标国的快递/空运/海运费用与时效。",
    method: "GET",
    path: "/api/shipping",
    parameters: { market: "国家代码", weightKg: "单件公斤", volumeCbm: "单件立方", quantity: "件数" },
  },
  {
    name: "list_products",
    description: "列出选品库中的中国货源产品及类目。",
    method: "GET",
    path: "/api/products",
    parameters: { q: "关键词", category: "类目 slug" },
  },
  {
    name: "list_markets",
    description: "列出目标市场的需求、竞争、增值税、低值免税额。",
    method: "GET",
    path: "/api/markets",
    parameters: {},
  },
] as const;

const EXISTING_TOOLS = `市面上已有工具，但没有一个同时覆盖「中国货源价 + 多国售价 + 关税 + 运费 + 需求」并开放给个人助手调用：

1. 店雷达 / Sorftime：1688 图搜反查 Amazon/TikTok/Shopee，偏选品插件，全成本模型不够透明。
2. SourceCalc：Chrome 插件，1688 页内粗算运费关税，国家少，无需求雷达。
3. SourceMogul / Arbitrage Cyclops：英美零售或 Amazon 站点互倒，不是中国供应链出发。
4. ArbiKey：Amazon→eBay 套利记账。
5. Helium 10 / Jungle Scout / Keepa：Amazon 需求与费用，不含 1688 货源与头程。
6. 超热卖利润计算器：Amazon 费用拆解，需手工填采购价。

贸差眼 TradeLens 要补的缺口：把差价、需求、海关、运费、平台费做成同一套引擎，并给 Hermes 等助手提供 API。`;

/** 两个字符串的最长公共子串长度。串都很短（问题 < 50 字，品名 < 20 字），DP 足够。 */
function longestCommonSubstring(a: string, b: string) {
  if (!a || !b) return 0;
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * 按品名模糊匹配商品。
 *
 * 中文没有词边界，用户不会输入完整品名——问「耳机」要能命中「私模半入耳蓝牙耳机」。
 * 因此取提问与品名的最长公共子串，≥ MIN_NAME_MATCH 字即算命中，并按匹配长度取最优，
 * 让「蓝牙耳机」优先于只共享「耳机」的其它商品。
 * SKU 与英文名仍走精确包含匹配。
 */
const MIN_NAME_MATCH = 2;

export function matchProduct<T extends { nameZh: string; nameEn: string; sku: string }>(
  question: string,
  products: T[],
): T | undefined {
  const q = question.trim();
  const lower = q.toLowerCase();

  const exact = products.find(
    (p) => lower.includes(p.sku.toLowerCase()) || (p.nameEn && lower.includes(p.nameEn.toLowerCase())),
  );
  if (exact) return exact;

  let best: T | undefined;
  let bestLen = MIN_NAME_MATCH - 1;
  for (const p of products) {
    const len = longestCommonSubstring(q, p.nameZh);
    if (len > bestLen) {
      bestLen = len;
      best = p;
    }
  }
  return best;
}

function topN(items: Opportunity[], n = 5) {
  return items.slice(0, n);
}

function formatOpp(o: Opportunity) {
  return `· ${o.flag} ${o.marketName}｜${o.nameZh}（${o.sku}）
  货源 ¥${o.sourcePriceCny.toFixed(2)} → ${o.platform} ${o.currency} ${o.sellPriceLocal}
  落地成本 ${money(o.result.landedUsd)}，单件净利润 ${money(o.result.netProfitUsd)}，利润率 ${pct(o.result.marginPct)}，ROI ${pct(o.result.roiPct)}
  需求分 ${o.demandScore}，月销约 ${o.monthlySales}，${o.shippingLabel} ${o.daysMin}-${o.daysMax} 天，综合分 ${o.score}`;
}

function replyForOpps(title: string, opps: Opportunity[]) {
  if (opps.length === 0) return `${title}\n\n当前筛选下没有满足条件的机会。试着放宽利润率，或改用海运。`;
  return `${title}\n\n${topN(opps, 6).map(formatOpp).join("\n\n")}\n\n判定标准：利润率 ≥25% 且单件净利 ≥$3 为可做；12–25% 为薄利测款。以上已计入采购、运费、保险、关税、不可抵扣增值税、平台佣金、履约、广告与退货。`;
}

export async function answerAssistant(question: string, catalog: Catalog) {
  const q = question.trim();
  const lower = q.toLowerCase();
  const opps = buildOpportunities(catalog);

  const marketHit = catalog.markets.find(
    (m) => q.includes(m.nameZh) || lower.includes(m.code.toLowerCase()) || lower.includes(m.nameEn.toLowerCase()),
  );
  const productHit = matchProduct(q, catalog.products);
  const categoryHit = catalog.categories.find(
    (c) => q.includes(c.nameZh) || lower.includes(c.slug) || lower.includes(c.nameEn.toLowerCase()),
  );

  if (/现成|有没有.*平台|竞品|店雷达|sorftime|keepa|helium|工具/.test(q) || /existing|competitor/.test(lower)) {
    return EXISTING_TOOLS;
  }

  if (/prd|需求文档|产品范围|做什么品|选什么品|品类/.test(q)) {
    const rec = catalog.categories
      .filter((c) => c.recommended)
      .map((c) => `· ${c.nameZh}（HS ${c.typicalHs}，${c.weightClass}，风险 ${c.riskLevel}）：${c.reason}`)
      .join("\n");
    return `建议先做「轻小、非标、低专利、食品接触或电子配件可认证」的品，而不是什么便宜拿什么。\n\n推荐范围：\n${rec}\n\n明确不做：品牌授权不明、带电超限、食品保健、医疗器械、儿童玩具无证书、纯低价红海。\n\n利润公式：售价 − 货源 − 运费 − 关税 − VAT − 平台费 − 广告 − 退货。没有需求的差价不是利润。`;
  }

  if (/hermes|助手|mcp|api|接入/.test(lower) || /助手|个人助理|怎么用/.test(q)) {
    const tools = HERMES_TOOLS.map((t) => `· ${t.name} ${t.method} ${t.path} — ${t.description}`).join("\n");
    return `可以把贸差眼当成 Hermes 的跨境交易工具箱。助手只负责提问与决策，计算仍走本站引擎。\n\n可用工具：\n${tools}\n\n给 Hermes 的系统提示示例：\n「你是跨境套利助手。所有利润必须调用 TradeLens API，禁止口头估算运费和关税。先 scan_opportunities，再 calculate_profit 验证，最后 lookup_customs 确认 HS。」\n\n打开 /tools 可复制完整接口说明。`;
  }

  if (/关税|海关|hs|税则|301|vat|gst/.test(lower) || /关税|海关|税/.test(q)) {
    const hs = productHit?.hsCode ?? (q.match(/\d{4}\.\d{2}/)?.[0] ?? "8518.30");
    const rows = catalog.tariffs.filter((t) => t.hsCode === hs);
    const lines = rows
      .map((t) => {
        const m = catalog.markets.find((x) => x.id === t.marketId);
        if (!m) return "";
        return `· ${m.flag} ${m.nameZh}：MFN ${pct(t.mfnDuty * 100)} + 附加 ${pct(t.extraDuty * 100)}，VAT/GST ${pct(t.vatRate * 100)}。${t.notes}；低值免税 $${m.deMinimisUsd}`;
      })
      .filter(Boolean)
      .join("\n");
    return `HS ${hs} 各国税负（示意税率，实操以报关行/官方税则为准）：\n\n${lines}\n\n注意：美国对中国小额包裹免税基本取消；欧盟 €150 以下免关税但仍收 VAT；VAT 若走 Amazon/IOSS 通常可视为代收而非成本。`;
  }

  if (/运费|物流|海运|空运|快递|时效/.test(q) || /shipping|freight/.test(lower)) {
    const market = marketHit ?? catalog.markets.find((m) => m.code === "US")!;
    const rates = catalog.shipping.filter((s) => s.marketId === market.id);
    const weight = productHit?.weightKg ?? 0.3;
    const cbm = productHit?.volumeCbm ?? 0.001;
    const lines = rates
      .map((s) => {
        const per =
          s.method === "sea_lcl" || s.method === "sea_fcl"
            ? Math.max(s.minChargeUsd, cbm * s.ratePerCbmUsd)
            : Math.max(s.minChargeUsd / 50, Math.max(weight, cbm * 167) * s.ratePerKgUsd);
        return `· ${s.methodZh}：约 ${money(per)}/件，${s.daysMin}-${s.daysMax} 天。${s.notes}`;
      })
      .join("\n");
    return `${market.flag} ${market.nameZh} 头程对照（按 ${productHit ? productHit.nameZh : "0.3kg 轻小件"} 估算）：\n\n${lines}\n\n经验：测款用快递，验证需求后空运，稳定复购再海运海外仓。体积重会让收纳、瑜伽垫在快递路径上亏掉差价。`;
  }

  if (productHit) {
    const related = opps.filter((o) => o.productId === productHit.id);
    const profile = `产品档案：${productHit.nameZh}（${productHit.sku}）\n货源 ${productHit.supplierPlatform} ¥${productHit.sourcePriceCny}，MOQ ${productHit.moq}，${productHit.weightKg} kg，HS ${productHit.hsCode}，认证 ${productHit.certifications}，IP 风险 ${productHit.ipRisk}。\n${productHit.description}`;

    // 「耳机卖美国怎么样」这类问法同时指定了品和国：先正面回答问到的那个市场，
    // 再附上其它市场做横向对比，并点出纯利最高的主攻国。
    if (marketHit) {
      const asked = related.find((o) => o.marketCode === marketHit.code);
      const others = related.filter((o) => o.marketCode !== marketHit.code);
      const best = [...related].sort((a, b) => b.result.netProfitUsd - a.result.netProfitUsd)[0];
      const verdict = asked
        ? `${marketHit.flag} ${marketHit.nameZh} 的结论：${asked.result.verdictLabel}\n\n${formatOpp(asked)}`
        : `${marketHit.flag} ${marketHit.nameZh}：该货源暂无此市场的在售参考价，无法给出可信测算。`;
      const advice =
        best && best.marketCode !== marketHit.code
          ? `\n\n主攻建议：同款在 ${best.flag} ${best.marketName} 的单件净利最高（${money(best.result.netProfitUsd)}，利润率 ${pct(best.result.marginPct)}），高于${marketHit.nameZh}。`
          : best
            ? `\n\n主攻建议：${marketHit.nameZh}就是这款目前纯利最高的市场。`
            : "";
      return `${profile}\n\n${verdict}${advice}\n\n${replyForOpps("其它市场横向对比：", others)}`;
    }

    return `${profile}\n\n${replyForOpps("该货源在各市场的全成本结果：", related)}`;
  }

  if (marketHit) {
    const related = opps.filter((o) => o.marketCode === marketHit.code && o.result.verdict !== "no");
    return `${marketHit.flag} ${marketHit.nameZh} 市场速写\n货币 ${marketHit.currency}，VAT ${pct(marketHit.vatRate * 100)}，低值免税 $${marketHit.deMinimisUsd}，需求 ${marketHit.demandIndex}，竞争 ${marketHit.competitionIndex}，物流 ${marketHit.logisticsScore}。\n${marketHit.notes}\n\n${replyForOpps("该市场当前可做机会：", related)}`;
  }

  if (categoryHit) {
    const related = opps.filter((o) => o.categorySlug === categoryHit.slug && o.result.marginPct >= 12);
    return `${categoryHit.nameZh}：${categoryHit.reason}\nHS 章 ${categoryHit.hsChapter}，重量级 ${categoryHit.weightClass}，风险 ${categoryHit.riskLevel}。\n\n${replyForOpps("类目内机会：", related)}`;
  }

  if (/利润|差价|机会|选品|做什么|推荐|赚钱/.test(q) || /profit|arbitrage|recommend/.test(lower)) {
    const go = opps.filter((o) => o.result.verdict === "go");
    return replyForOpps("按全成本引擎排序的可做机会：", go.length ? go : opps);
  }

  if (/公式|怎么算|成本/.test(q)) {
    const sample = opps[0];
    if (!sample) return "样本不足。";
    const lines = sample.result.lines
      .map((l) => `  ${l.label}: ${money(l.usd)}${l.note ? `（${l.note}）` : ""}`)
      .join("\n");
    return `利润不是「国外售价 − 1688 价」。正确拆解（以 ${sample.nameZh} → ${sample.marketName} 为例）：\n\n${lines}\n  落地成本 ${money(sample.result.landedUsd)}\n  售价 ${money(sample.result.sellUsd)}\n  单件净利 ${money(sample.result.netProfitUsd)}，利润率 ${pct(sample.result.marginPct)}，ROI ${pct(sample.result.roiPct)}\n\n需求决定能不能卖出去，差价决定卖出去后剩多少。两样缺一不可。`;
  }

  const go = opps.filter((o) => o.result.verdict === "go").slice(0, 3);
  return `我是贸差眼助手，专门算「中国货源 × 海外需求 × 全成本利润」。\n\n你可以问：现在做什么品最赚钱、美国关税怎么算、瑜伽垫该海运还是快递、如何把接口给 Hermes。\n\n当前引擎里的三条高分机会：\n${go.map(formatOpp).join("\n\n")}`;
}

export async function runAssistant(question: string) {
  const catalog = await loadCatalog();
  return answerAssistant(question, catalog);
}

export { calculateProfit, EXISTING_TOOLS };
