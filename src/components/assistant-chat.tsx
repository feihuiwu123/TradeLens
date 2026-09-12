"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "现在做什么品最赚钱？",
  "美国对中国货关税怎么算？",
  "瑜伽垫该海运还是快递？",
  "宠物用品在澳大利亚有没有差价？",
  "有哪些现成比价工具？",
  "怎么把接口给 Hermes 用？",
];

type Msg = { role: "user" | "assistant"; content: string };

export function AssistantChat({ seed }: { seed?: string }) {
  const [messages, setMessages] = useState<Msg[]>(
    seed
      ? [{ role: "assistant", content: seed }]
      : [
          {
            role: "assistant",
            content: "我是贸差眼助手。问我选品、差价、关税、运费，或让我给 Hermes 写调用说明。所有利润都按全成本引擎算，不口头估算。",
          },
        ],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

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
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as { answer?: string };
      setMessages((m) => [...m, { role: "assistant", content: data.answer ?? "暂时无法回答。" }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="panel flex min-h-[520px] flex-col rounded-[2rem] p-5">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <article
              key={`${m.role}-${i}`}
              className={`max-w-[46rem] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                m.role === "user" ? "ml-auto bg-[var(--gold)] text-[#071018]" : "border border-[var(--line)] bg-black/20"
              }`}
            >
              {m.content}
            </article>
          ))}
          {pending ? <p className="text-sm text-[var(--muted)]">正在按税则和运价重算…</p> : null}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="问：墨西哥车载支架还有没有利润？" />
          <button type="submit" className="rounded-full bg-[var(--gold)] px-5 text-sm text-[#071018]">
            发送
          </button>
        </form>
      </div>
      <aside className="space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="panel w-full rounded-2xl px-4 py-3 text-left text-sm"
          >
            {s}
          </button>
        ))}
      </aside>
    </div>
  );
}
