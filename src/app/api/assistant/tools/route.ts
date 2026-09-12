import { HERMES_TOOLS } from "@/lib/assistant";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    name: "TradeLens",
    description: "中国货源到全球市场的全成本利润引擎，供 Hermes 等个人助手调用。",
    tools: HERMES_TOOLS,
  });
}
