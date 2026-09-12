import { SectionTitle } from "@/components/ui";
import { HERMES_TOOLS } from "@/lib/assistant";

export default function ToolsPage() {
  const prompt = `你是跨境套利助手，对接贸差眼 TradeLens。规则：
1. 任何利润数字必须调用 API，禁止口头估算运费和关税。
2. 先 GET /api/opportunities 扫描，再 POST /api/calculator 验证。
3. 涉及清关时 GET /api/customs?hs=，涉及头程时 GET /api/shipping。
4. 只推荐判定为 go 或 thin 的 SKU；no 的说明哪一项成本打穿了利润。
5. 回答结构：结论 → 数字（净利/利润率/ROI/时效）→ 风险（认证/专利/电池）→ 下一步。`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <SectionTitle
        kicker="HERMES / MCP TOOLS"
        title="把贸差眼接进个人助手"
        desc="站内助手已经会查库。把下面的系统提示和工具表贴给 Hermes、Claude 或自建 Agent，它们就能按同一套引擎选品。"
      />
      <section className="panel rounded-[2rem] p-7">
        <h2 className="font-serif text-2xl">系统提示（复制给 Hermes）</h2>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-4 text-sm text-[var(--gold-2)]">
          {prompt}
        </pre>
      </section>
      <section className="mt-6 space-y-4">
        {HERMES_TOOLS.map((tool) => (
          <article key={tool.name} className="panel rounded-3xl p-6">
            <p className="font-display text-xs tracking-[0.2em] text-[var(--gold)]">{tool.method} {tool.path}</p>
            <h3 className="font-serif mt-1 text-2xl">{tool.name}</h3>
            <p className="mt-2 text-[var(--muted)]">{tool.description}</p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
              {Object.entries(tool.parameters).map(([k, v]) => (
                <li key={k}>
                  <span className="text-[var(--gold)]">{k}</span> · {v}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section className="panel mt-6 rounded-[2rem] p-7 text-sm text-[var(--muted)]">
        <h2 className="font-serif text-2xl text-[var(--ink)]">推荐工作流</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>Hermes 每天扫描 US/DE/MX/AU，minMargin=20。</li>
          <li>对综合分 ≥70 的 SKU 再算 express 与 sea_lcl 两条路径。</li>
          <li>查 HS，排除附加税把利润率打到 12% 以下的货。</li>
          <li>输出 3 个可做 SKU：采购数量、物流、认证待办。</li>
          <li>用户确认后加入观察名单 POST /api/watchlist。</li>
        </ol>
      </section>
    </main>
  );
}
