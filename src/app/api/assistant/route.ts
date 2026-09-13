import { z } from "zod";
import { runAssistant } from "@/lib/assistant";
import { parseJson, route } from "@/server/http";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const askSchema = z.object({
  question: z.string().trim().min(1, "问题不能为空").max(2000, "问题过长"),
  /**
   * 是否对识别到的商品做实盘核验。
   * 默认开启，但只有问句确实命中某个商品时才会真的抓取——
   * 通用问句走不到商品分支，抓了也用不上。
   */
  live: z.boolean().default(true),
});

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, askSchema);
  if (!parsed.ok) return parsed.response;

  const { question, live } = parsed.data;
  const answer = await runAssistant(question, { live });

  // 对话留存失败不应该让用户拿不到答案，单独降级。
  try {
    await getStore().appendAssistantMessages([
      { role: "user", content: question },
      { role: "assistant", content: answer },
    ]);
  } catch (error) {
    console.error("[TradeLens] 助手对话留存失败:", error);
  }

  return Response.json({ answer });
});
