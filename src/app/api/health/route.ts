import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  try {
    await store.ping();
    return Response.json({ ok: true, store: store.kind, durable: store.durable });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        store: store.kind,
        durable: store.durable,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
