import { z } from "zod";
import { buildCalcInput, findFee, findShipping, findTariff, loadCatalog } from "@/lib/catalog";
import { calculateProfit } from "@/lib/profit";
import { marketCodeSchema, notFound, parseJson, route, shippingMethodSchema } from "@/server/http";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

const calcSchema = z.object({
  sku: z.string().trim().min(1),
  market: marketCodeSchema.default("US"),
  shippingMethod: shippingMethodSchema.default("express"),
  quantity: z.number().int().positive().max(1_000_000).optional(),
  sourcePriceCny: z.number().nonnegative().optional(),
  sellPriceLocal: z.number().positive().optional(),
  // 比率统一用 0~1 小数，避免 8 与 0.08 混用导致利润算错一个数量级
  adsRate: z.number().min(0).max(1).optional(),
  returnRate: z.number().min(0).max(1).optional(),
  save: z.boolean().default(false),
  title: z.string().trim().max(200).optional(),
});

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, calcSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const catalog = await loadCatalog();

  // 找不到就报错，不做静默回退：拿着 A 商品的参数返回 B 商品的利润，
  // 比直接失败危险得多。
  const product = catalog.products.find((p) => p.sku === body.sku);
  if (!product) return notFound(`未收录 SKU ${body.sku}`);

  const market = catalog.markets.find((m) => m.code === body.market);
  if (!market) return notFound(`未收录市场 ${body.market}`);

  const listing = catalog.listings.find((l) => l.productId === product.id && l.marketId === market.id);
  if (!listing) return notFound(`${product.nameZh} 暂无 ${market.code} 市场的在售参考价`);

  const shipping = findShipping(catalog.shipping, market.id, body.shippingMethod);
  if (!shipping) return notFound(`${market.code} 暂无 ${body.shippingMethod} 运价`);

  const input = buildCalcInput({
    product: { ...product, sourcePriceCny: body.sourcePriceCny ?? product.sourcePriceCny },
    market,
    listing: { ...listing, sellPrice: body.sellPriceLocal ?? listing.sellPrice },
    shipping,
    tariff: findTariff(catalog.tariffs, product.hsCode, market.id),
    fee: findFee(catalog.fees, listing.platform, market.id),
    fx: catalog.fx,
    quantity: body.quantity,
    adsRate: body.adsRate,
    returnRate: body.returnRate,
  });
  const result = calculateProfit(input);

  if (body.save) {
    await getStore().saveCalc({
      title: body.title ?? `${product.nameZh} → ${market.code}`,
      payload: { ...body, sku: product.sku, market: market.code },
      netProfitUsd: result.netProfitUsd,
      marginPct: result.marginPct,
    });
  }

  return Response.json({
    sku: product.sku,
    market: market.code,
    shippingMethod: body.shippingMethod,
    result,
  });
});

export const GET = route(async () => {
  const items = await getStore().listSavedCalcs();
  return Response.json({ items });
});
