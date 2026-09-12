"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "雷达" },
  { href: "/opportunities", label: "机会" },
  { href: "/products", label: "货源" },
  { href: "/calculator", label: "全成本" },
  { href: "/customs", label: "海关" },
  { href: "/shipping", label: "运费" },
  { href: "/markets", label: "市场" },
  { href: "/watchlist", label: "观察" },
  { href: "/assistant", label: "助手" },
  { href: "/prd", label: "PRD" },
  { href: "/tools", label: "Hermes" },
];

/**
 * 内联 SVG 标识：两条价格线之间的差值（Δ）——就是本产品的全部主题。
 * 用矢量而非位图，省掉一个静态资源依赖，颜色也直接跟随主题变量。
 */
function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="贸差眼"
      className="h-10 w-10 rounded-xl border border-[var(--line)] bg-[#0a1620]"
    >
      <path d="M8 27 L18 14 L28 27 Z" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="8" y1="31.5" x2="32" y2="31.5" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="30" cy="12" r="3" fill="var(--gold-2)" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#071018]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark />
          <span className="leading-tight">
            <span className="font-display block text-sm tracking-[0.18em] text-[var(--gold)]">TRADELENS</span>
            <span className="font-serif text-lg">贸差眼</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  active ? "bg-[var(--gold)] text-[#071018]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="rounded-full border border-[var(--line)] px-3 py-1 text-sm lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          菜单
        </button>
      </div>
      {open ? (
        <div className="grid grid-cols-3 gap-2 px-5 pb-4 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-center text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function Footer({ durable = true }: { durable?: boolean }) {
  return (
    <footer className="mt-20 border-t border-[var(--line)]">
      {durable ? null : (
        <div className="border-b border-[var(--line)] bg-[rgba(251,191,36,0.08)]">
          <p className="mx-auto max-w-7xl px-5 py-2.5 text-sm text-[var(--warn)]">
            演示模式：未配置 DATABASE_URL，自选与测算记录仅保存在内存中，服务重启后会清空。
          </p>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
        <p>贸差眼 TradeLens · 中国货源到全球市场的全成本利润雷达</p>
        <p>税率与运价为可校准模型，实操请复核报关行与承运商报价。</p>
      </div>
    </footer>
  );
}
