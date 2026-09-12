import { SectionTitle } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomsPage({
  searchParams,
}: {
  searchParams: Promise<{ hs?: string }>;
}) {
  const { hs } = await searchParams;
  const catalog = await loadCatalog();
  const codes = [...new Set(catalog.tariffs.map((t) => t.hsCode))];
  const selected = hs && codes.includes(hs) ? hs : codes[0];
  const rows = catalog.tariffs.filter((t) => t.hsCode === selected);
  const product = catalog.products.find((p) => p.hsCode === selected);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="CUSTOMS"
        title="HS 关税与增值税对照"
        desc="关税按 CIF（货值+运费+保险）计征，VAT 通常按 CIF+关税。美国对中国小额免税按 0 处理，301 附加税单独列出。"
      />
      <form className="mb-8 flex flex-wrap gap-2">
        {codes.map((code) => (
          <a
            key={code}
            href={`/customs?hs=${code}`}
            className={`rounded-full px-4 py-2 text-sm ${
              code === selected ? "bg-[var(--gold)] text-[#071018]" : "border border-[var(--line)]"
            }`}
          >
            {code}
          </a>
        ))}
      </form>
      <div className="panel mb-6 rounded-3xl p-6">
        <p className="text-sm text-[var(--muted)]">当前编码 {selected} {product ? `· 样本货 ${product.nameZh}` : ""}</p>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          报关时以商检、材质、用途为准，子目可能从 6 位细化到 10 位。此处用于选品阶段排除明显不赚钱的税负结构。
        </p>
      </div>
      <div className="panel overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="p-4">市场</th>
              <th>MFN</th>
              <th>附加（如 301）</th>
              <th>合计关税</th>
              <th>VAT / GST</th>
              <th>低值免税</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const m = catalog.markets.find((x) => x.id === t.marketId);
              if (!m) return null;
              return (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="p-4">{m.flag} {m.nameZh}</td>
                  <td className="num">{pct(t.mfnDuty * 100)}</td>
                  <td className="num">{pct(t.extraDuty * 100)}</td>
                  <td className="num text-[var(--gold)]">{pct((t.mfnDuty + t.extraDuty) * 100)}</td>
                  <td className="num">{pct(t.vatRate * 100)}</td>
                  <td className="num">${m.deMinimisUsd}</td>
                  <td className="py-3 pr-4 text-[var(--muted)]">{t.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
