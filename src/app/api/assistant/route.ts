import { z } from "zod";
import { runAssistant } from "@/lib/assistant";
import { parseJson, route } from "@/server/http";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

const askSchema = z.object({
  question: z.string().trim().min(1, "问题不能为空").max(2000, "问题过长"),
});

export const POST = route(async (request: Request) => {
  const parsed = await parseJson(request, askSchema);
  if (!parsed.ok) return parsed.response;

  const { question } = parsed.data;
  const answer = await runAssistant(question);

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
