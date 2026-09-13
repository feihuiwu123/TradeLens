"use client";

import { useState } from "react";
import { ExternalLink, Zap } from "lucide-react";

const SUGGESTIONS = [
  "耳机卖美国怎么样？",
  "笔记本支架在英国有利润吗？",
  "现在做什么品最赚钱？",
  "美国对中国货关税怎么算？",
  "瑜伽垫该海运还是快递？",
  "怎么把接口给 Hermes 用？",
];

type Msg = { role: "user" | "assistant"; content: string };

/**
 * 把回答里的裸 URL 渲染成可点链接。
 *
 * 实盘核验段落会带真实商品页地址，纯文本展示等于让用户手动复制——
 * 这些链接正是「价格从哪来」的证据，必须一点即达。
 */
function renderContent(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-0.5 break-all text-sky-300 underline decoration-sky-300/40 hover:decoration-sky-300"
      >
        {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 42)}
        <ExternalLink size={10} className="shrink-0" />
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function AssistantChat({ seed }: { seed?: string }) {
  const [messages, setMessages] = useState<Msg[]>(
    seed
      ? [{ role: "assistant", content: seed }]
      : [
          {
            role: "assistant",
            content:
              "我是贸差眼助手。问我选品、差价、关税、运费，或让我给 Hermes 写调用说明。所有利润都按全成本引擎算，不口头估算。\n\n问到具体商品时，我会顺带从各站抓真实在售价核验一遍——基准值经常偏高，核验后结论可能反转。",
          },
        ],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState(true);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setPending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, live }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? data.error ?? "暂时无法回答。" },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: e instanceof Error ? `请求失败：${e.message}` : "网络异常。" },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-[540px] flex-col rounded-2xl border border-slate-800 bg-[#0c1530]/80 p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <article
              key={`${m.role}-${i}`}
              className={`max-w-[46rem] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                m.role === "user"
                  ? "ml-auto bg-amber-400 font-medium text-slate-900"
                  : "border border-slate-800 bg-[#0a1226] text-slate-200"
              }`}
            >
              {m.role === "assistant" ? renderContent(m.content) : m.content}
            </article>
          ))}
          {pending ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              {live ? "正在按税则和运价重算，并从各站抓实时在售价（首次约十几秒）…" : "正在按税则和运价重算…"}
            </p>
          ) : null}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问：墨西哥车载支架还有没有利润？"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 text-sm font-extrabold text-slate-900 hover:brightness-110 disabled:opacity-50"
          >
            发送
          </button>
        </form>

        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="!w-auto" />
          <Zap size={12} className={live ? "text-amber-300" : "text-slate-600"} />
          <span>
            实盘核验：问到具体商品时，额外抓取各站真实在售价与基准值对比
            <span className="text-slate-600">（关掉可秒回，但只有模型基准值）</span>
          </span>
        </label>
      </div>

      <aside className="space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => void send(s)}
            className="w-full rounded-xl border border-slate-800 bg-[#0c1530]/80 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-[#0e1836] disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </aside>
    </div>
  );
}
