import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/shell";
import { loadCatalog } from "@/lib/catalog";
import { getStore } from "@/server/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "贸差眼 TradeLens · 中国到全球的全成本利润雷达",
  description: "把 1688 货源、海外需求、关税、运费、平台费算进同一张利润表，并开放给 Hermes 等个人助手调用。",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const catalog = await loadCatalog();

  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Header marketCount={catalog.markets.length} />
        {children}
        <Footer durable={getStore().durable} />
      </body>
    </html>
  );
}
