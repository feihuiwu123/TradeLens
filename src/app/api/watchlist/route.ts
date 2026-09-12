import { z } from "zod";
import { parseJson, parseQuery, route } from "@/server/http";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

const watchKeySchema = z.object({
  productId: z.coerce.number().int().positive(),
  marketId: z.coerce.number().int().positive(),
});

const addSchema = watchKeySchema.extend({
  note: z.string().max(500).optional(),
});

export const GET = route(async () => {
  const items = await getStore().listWatchlist();
  return Response.json({ items });
});

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, addSchema);
  if (!parsed.ok) return parsed.response;
  await getStore().addWatch(parsed.data);
  return Response.json({ ok: true });
});

export const DELETE = route(async (request: Request) => {
  const parsed = parseQuery(request, watchKeySchema);
  if (!parsed.ok) return parsed.response;
  await getStore().removeWatch(parsed.data);
  return Response.json({ ok: true });
});
