import { Gauge } from "lucide-react";
import { CalibrationBoard } from "@/components/calibration-board";
import { PageHead } from "@/components/ui";
import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  const catalog = await loadCatalog();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHead
        icon={Gauge}
        zh="基准值校准"
        en="CALIBRATION"
        desc="用实测在售价核对榜单的模型基准值，按真实售价重算全成本利润，找出被高估的机会"
      />
      <CalibrationBoard
        markets={catalog.markets.map((m) => ({ code: m.code, nameZh: m.nameZh }))}
      />
    </main>
  );
}
