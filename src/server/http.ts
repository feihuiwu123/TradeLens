import { z } from "zod";

/**
 * API 边界统一处理：入参校验、错误归一化。
 *
 * 目的是让业务路由只写业务逻辑，不重复写 try/catch 和 400 响应，
 * 同时保证对外错误格式一致（Hermes 这类外部调用方需要可预期的错误结构）。
 */

export type ApiError = {
  error: string;
  /** 字段级校验失败明细，仅在 400 时出现 */
  issues?: { path: string; message: string }[];
};

export function badRequest(message: string, issues?: ApiError["issues"]) {
  return Response.json({ error: message, ...(issues ? { issues } : {}) } satisfies ApiError, {
    status: 400,
  });
}

export function notFound(message: string) {
  return Response.json({ error: message } satisfies ApiError, { status: 404 });
}

function zodIssues(error: z.ZodError): ApiError["issues"] {
  return error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}

/** 解析并校验 JSON 请求体。 */
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest("请求体不是合法的 JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: badRequest("请求参数校验失败", zodIssues(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

/** 解析并校验 URL query。 */
export function parseQuery<T extends z.ZodType>(
  request: Request,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; response: Response } {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, response: badRequest("查询参数校验失败", zodIssues(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * 包裹路由处理函数，把未预期异常转成 500，
 * 避免把数据库连接串之类的内部信息透给调用方。
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[TradeLens] 未处理的接口异常:", error);
      return Response.json({ error: "服务内部错误" } satisfies ApiError, { status: 500 });
    }
  };
}

/** 共用的枚举/强制转换片段 */
export const shippingMethodSchema = z.enum(["express", "air", "sea_lcl", "sea_fcl"]);
export const marketCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(4)
  .transform((s) => s.toUpperCase());
