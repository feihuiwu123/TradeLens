import { Compass } from "lucide-react";
import { OpportunityBoard } from "@/components/opportunity-board";
import { PageHead } from "@/components/ui";
import { buildOpportunities, cnyPerUsd, loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const catalog = await loadCatalog();
  const items = buildOpportunities(catalog);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHead
        icon={Compass}
        zh="机会发现"
        en="DISCOVER"
        desc="中 vs 外 · 差价榜单：每条机会都按货源、运费、关税、VAT、平台费、广告与退货重算"
      />
      <OpportunityBoard
        items={items}
        markets={catalog.markets.map((m) => ({ code: m.code, nameZh: m.nameZh, flag: m.flag }))}
        categories={catalog.categories.map((c) => ({ slug: c.slug, nameZh: c.nameZh }))}
        cnyPerUsd={cnyPerUsd(catalog.fx)}
      />
    </main>
  );
}
