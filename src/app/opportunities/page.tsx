import { OpportunityBoard } from "@/components/opportunity-board";
import { SectionTitle } from "@/components/ui";
import { buildOpportunities, loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const catalog = await loadCatalog();
  const items = buildOpportunities(catalog);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="OPPORTUNITY SCAN"
        title="差价机会雷达"
        desc="每条机会都按货源、运费、关税、VAT、平台费、广告与退货重算。分数高不代表能铺货，还要看认证与专利。"
      />
      <OpportunityBoard
        items={items}
        markets={catalog.markets.map((m) => ({ code: m.code, nameZh: m.nameZh, flag: m.flag }))}
        categories={catalog.categories.map((c) => ({ slug: c.slug, nameZh: c.nameZh }))}
      />
    </main>
  );
}
