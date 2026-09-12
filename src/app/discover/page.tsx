import { Radar } from "lucide-react";
import { SpreadFinder } from "@/components/spread-finder";
import { PageHead } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";
import { taxonomyTree } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const catalog = await loadCatalog();

  // 按小额免税门槛从高到低排——门槛是跨境套利最大的单一变量，
  // 默认让用户先看到最容易免税清关的市场。
  const markets = [...catalog.markets]
    .sort((a, b) => b.deMinimisUsd - a.deMinimisUsd)
    .map((m) => ({ code: m.code, nameZh: m.nameZh, flag: m.flag }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHead
        icon={Radar}
        zh="价差发现"
        en="SPREAD FINDER"
        desc="按需测算：输入一个中国货源与各国在售价，一次算清落地成本、关税、VAT、平台费后的真实净利并排序"
      />
      <SpreadFinder markets={markets} tree={taxonomyTree(catalog)} />
    </main>
  );
}
