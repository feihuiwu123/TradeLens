import { createEcbFxProvider } from "@/server/providers/ecb";
import type { Sourced } from "@/server/providers/types";

/**
 * 汇率服务：带 TTL 缓存的 ECB 取数，失败时静默降级。
 *
 * ECB 每个工作日约 16:00 CET 发布一次，所以 6 小时缓存足够，
 * 既不会漏掉当日更新，也不会每次渲染都打外网。
 *
 * 关键约束：这里永远不抛错。外部源不可达时返回 null，
 * 由调用方回退到种子基准值——汇率拿不到不应该让整个站点打不开。
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

type Cache = {
  at: number;
  data: Sourced<Record<string, number>> | null;
};

const globalForFx = globalThis as typeof globalThis & { __tradeLensFxCache?: Cache };

/** 汇率来源状态，供 UI 标注数据来源 */
export type FxStatus = { live: boolean; source: string; fetchedAt: Date | null };

/**
 * 从缓存派生状态，而不是另存一个模块级变量。
 *
 * 之前用独立的 let 记录状态，结果 Next.js 给布局和目录路径打了不同的模块实例，
 * 缓存挂在 globalThis 上是共享的、状态变量却不是，页脚因此一直显示「种子基准值」，
 * 而实际用的是实时汇率——标注和真相对不上比不标注更糟。
 */
export function getFxStatus(): FxStatus {
  const cached = globalForFx.__tradeLensFxCache;
  if (!cached) return { live: false, source: "种子基准值（尚未取数）", fetchedAt: null };
  if (!cached.data) return { live: false, source: "种子基准值（实时汇率不可达）", fetchedAt: null };
  return { live: true, source: cached.data.source, fetchedAt: cached.data.fetchedAt };
}

export async function getLiveFx(
  currencies: string[],
): Promise<Sourced<Record<string, number>> | null> {
  const cached = globalForFx.__tradeLensFxCache;
  const now = Date.now();

  if (cached) {
    const age = now - cached.at;
    // 成功的结果缓存 6 小时；失败的结果只缓存 10 分钟，避免一次抖动后长时间不重试
    const ttl = cached.data ? TTL_MS : RETRY_AFTER_FAILURE_MS;
    if (age < ttl) return cached.data;
  }

  try {
    const data = await createEcbFxProvider().cnyPer(currencies);
    globalForFx.__tradeLensFxCache = { at: now, data };
    return data;
  } catch (error) {
    console.warn(
      "[TradeLens] 实时汇率获取失败，回退到种子基准值:",
      error instanceof Error ? error.message : error,
    );
    globalForFx.__tradeLensFxCache = { at: now, data: null };
    return null;
  }
}
