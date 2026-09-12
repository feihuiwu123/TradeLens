"use client";

import { useState } from "react";

export function WatchButton({ productId, marketId, watched }: { productId: number; marketId: number; watched: boolean }) {
  const [on, setOn] = useState(watched);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      if (on) {
        await fetch(`/api/watchlist?productId=${productId}&marketId=${marketId}`, { method: "DELETE" });
        setOn(false);
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, marketId }),
        });
        setOn(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-5 py-2.5 text-sm ${on ? "bg-[var(--gold)] text-[#071018]" : "border border-[var(--line)]"}`}
    >
      {on ? "已加入观察" : "加入观察名单"}
    </button>
  );
}
