import Link from "next/link";
import { Badge, SectionTitle } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const catalog = await loadCatalog();
  const rows = catalog.products.filter((p) => {
    if (!category) return true;
    const cat = catalog.categories.find((c) => c.id === p.categoryId);
    return cat?.slug === category;
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="CHINA SOURCING"
        title="中国货源样本库"
        desc="聚焦轻小非标、可认证、专利风险可控的品。价格来自 1688/Alibaba 量级的示意成交价，用于训练选品判断。"
      />
      <div className="mb-8 flex flex-wrap gap-2">
        <Link href="/products" className="rounded-full border border-[var(--line)] px-3 py-1 text-sm">
          全部
        </Link>
        {catalog.categories.map((c) => (
          <Link key={c.slug} href={`/products?category=${c.slug}`} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm">
            {c.nameZh}
          </Link>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const cat = catalog.categories.find((c) => c.id === p.categoryId);
          return (
            <Link key={p.id} href={`/products/${p.id}`} className="panel overflow-hidden rounded-3xl">
              <img src={p.imageUrl} alt={p.nameZh} className="h-44 w-full object-cover" />
              <div className="space-y-3 p-5">
                <div className="flex gap-2">
                  <Badge>{cat?.nameZh}</Badge>
                  <Badge tone={p.ipRisk === "high" ? "no" : p.ipRisk === "medium" ? "warn" : "ok"}>IP {p.ipRisk}</Badge>
                </div>
                <h3 className="font-serif text-2xl">{p.nameZh}</h3>
                <p className="text-sm text-[var(--muted)]">{p.description}</p>
                <div className="flex justify-between text-sm">
                  <span className="num">¥{p.sourcePriceCny.toFixed(2)}</span>
                  <span>{p.weightKg} kg · HS {p.hsCode}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
