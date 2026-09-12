"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  Calculator,
  Compass,
  Eye,
  FileText,
  Layers,
  Menu,
  Package,
  Radar,
  Ship,
  Stamp,
  X,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "雷达", icon: Radar },
  { href: "/opportunities", label: "机会", icon: Compass },
  { href: "/products", label: "货源", icon: Package },
  { href: "/calculator", label: "全成本", icon: Calculator },
  { href: "/customs", label: "海关", icon: Stamp },
  { href: "/shipping", label: "运费", icon: Ship },
  { href: "/markets", label: "市场", icon: Layers },
  { href: "/watchlist", label: "观察", icon: Eye },
  { href: "/assistant", label: "助手", icon: Bot },
  { href: "/prd", label: "PRD", icon: FileText },
  { href: "/tools", label: "Hermes", icon: Bot },
];

export function Header({ marketCount }: { marketCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070d1a]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-xl">
            🧭
          </span>
          <span>
            <span className="block text-base font-black leading-5">
              贸差眼 <span className="gold-text">TradeLens</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              中外贸易差价利润分析 · 中国 ⇄ 全球{marketCount ? `${marketCount}国` : "市场"}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-2.5 py-2 text-[13px] font-bold transition ${
                  active ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          aria-label="菜单"
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 xl:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <nav className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3 sm:grid-cols-3 xl:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${
                  active ? "bg-amber-400 text-slate-900" : "bg-slate-800/60 text-slate-200"
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}

export function Footer({ durable = true }: { durable?: boolean }) {
  return (
    <footer className="mt-16 border-t border-slate-800/80">
      {durable ? null : (
        <div className="border-b border-slate-800/80 bg-amber-400/10">
          <p className="mx-auto max-w-7xl px-4 py-2.5 text-xs text-amber-200">
            演示模式：未配置 DATABASE_URL，自选与测算记录仅保存在内存中，服务重启后会清空。
          </p>
        </div>
      )}
      <p className="mx-auto max-w-7xl px-4 py-6 text-xs leading-6 text-slate-500">
        贸差眼 TradeLens · 税率与运价为可校准的模型基准值，非实时行情 · 正式决策前请复核报关行与承运商报价及认证要求
        <br />
        公式：净利 = 售价 − 采购 − 运费 − 关税 − VAT − 平台费 − 广告 − 退货 − 杂费
      </p>
    </footer>
  );
}
