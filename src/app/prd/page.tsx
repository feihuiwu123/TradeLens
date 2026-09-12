import Link from "next/link";
import { SectionTitle } from "@/components/ui";

export default function PrdPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <SectionTitle kicker="PRODUCT REQUIREMENTS" title="贸差眼 TradeLens PRD" desc="v1.0 · 中国货源到全球零售的全成本套利操作系统" />
      <article className="panel space-y-8 rounded-[2rem] p-8 leading-7 text-[var(--ink)] md:p-12">
        <section>
          <h2 className="font-serif text-3xl">1. 背景与机会</h2>
          <p className="mt-3 text-[var(--muted)]">
            网上贸易能成立，前提是利润。利润只来自两件事：真实需求，以及覆盖全部摩擦成本之后的差价。1688/工厂价看起来便宜，但国际运费、HS 关税、301 附加、VAT、平台佣金、FBA、广告、退货任何一项没算，都会把利润表打穿。
          </p>
          <p className="mt-3 text-[var(--muted)]">
            现成工具是碎片化的：店雷达/Sorftime 擅长图搜同款，SourceCalc 能在 1688 页内粗算，Helium 10/Keepa 懂 Amazon 需求，超热卖拆 Amazon 费用，SourceMogul/Cyclops 做英美零售或站点互倒。没有一个产品同时做到：中国货源 × 多国售价 × 海关 × 运费 × 需求评分 × 对 Hermes 开放。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">2. 产品原则</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>不展示「毛差价」，只展示全成本净利、利润率、ROI。</li>
            <li>没有需求分数的机会不得进入「可做」。</li>
            <li>美国对中国小额免税默认 0；VAT 能否抵扣按渠道区分。</li>
            <li>税率与运价可校准，但不允许用户跳过这两项。</li>
            <li>助手（站内或 Hermes）必须调用引擎，禁止口算运费关税。</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-3xl">3. 目标用户</h2>
          <p className="mt-3 text-[var(--muted)]">
            个人/小团队跨境卖家、货代型选品顾问、想用 Hermes 自动盯盘的独立经营者。不是品牌方 ERP，不做报关单申报。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">4. 产品范围（做什么品）</h2>
          <p className="mt-3 text-[var(--muted)]">v1 只收录同时满足以下条件的类目：</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>单件 ≤ 1.5 kg 或可压缩体积，头程不至于吃掉差价。</li>
            <li>非标外观，专利与品牌风险可控。</li>
            <li>目标市场有内容电商或长尾搜索需求。</li>
            <li>认证路径清晰：CE/FCC/FDA/CPC/PSE 等可前置。</li>
          </ul>
          <p className="mt-3 text-[var(--muted)]">
            十个种子类目：3C 配件、家居收纳、宠物、运动健身、美妆工具、母婴、户外、厨房小工具、汽车配件、办公数码。
          </p>
          <p className="mt-3 text-[var(--muted)]">
            明确不做：食品保健、医疗器械、超限带电、童车玩具无证书、品牌授权不明、纯低价红海手机壳大牌同款。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">5. 利润引擎</h2>
          <p className="mt-3 text-[var(--muted)]">
            落地成本 = 货源（CNY/汇率）+ 包装 + 验货摊销 + 头程运费 + 保险 + 关税（MFN+附加）+ 不可抵扣 VAT。
          </p>
          <p className="mt-3 text-[var(--muted)]">
            净利 = 售价美元 − 落地成本 − 平台佣金 − 履约 − 支付手续费 − 广告 − 退货损耗。
          </p>
          <p className="mt-3 text-[var(--muted)]">
            判定：利润率 ≥25% 且单件净利 ≥$3 → 可做；≥12% 且 ≥$1.2 → 薄利测款；否则不做。
          </p>
          <p className="mt-3 text-[var(--muted)]">
            综合分 = 利润 32% + ROI 18% + 需求 22% + 竞争 14% + 时效 8% + 物流 6%，高 IP 风险降权。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">6. 海关与运费</h2>
          <p className="mt-3 text-[var(--muted)]">
            每个 SKU 绑定 6 位 HS。市场侧维护 MFN、附加税、VAT、低值免税额。运费四条路径：快递、空运专线、海运 LCL、海运 FCL。空运按体积重 167 kg/cbm。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">7. 功能清单 v1</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>机会雷达：按市场/类目/物流/利润率过滤。</li>
            <li>货源档案：多国售价对照与瀑布成本。</li>
            <li>全成本计算器：可改售价、广告、退货做敏感度。</li>
            <li>海关税则表、运费对照、12 国市场卡。</li>
            <li>观察名单与测算存档。</li>
            <li>站内助手 + Hermes 工具 API。</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-3xl">8. Hermes 用法</h2>
          <p className="mt-3 text-[var(--muted)]">
            助手每日调用 scan_opportunities，对综合分 ≥70 且判定为可做的 SKU 再跑 calculate_profit，核对 lookup_customs，写入观察名单。禁止在对话里手算运费。详见 <Link href="/tools" className="text-[var(--gold)]">/tools</Link>。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">9. 数据边界</h2>
          <p className="mt-3 text-[var(--muted)]">
            v1 使用可校准的样本货源与示意税率，用于决策训练和工作流，不替代正式报关、也不抓取平台实时反爬数据。接入真实 1688/Amazon 源是 v2。
          </p>
        </section>
        <section>
          <h2 className="font-serif text-3xl">10. 成功标准</h2>
          <p className="mt-3 text-[var(--muted)]">
            用户能在 3 分钟内回答：这个中国货源，发美国/德国/墨西哥，用快递还是海运，扣完所有费用后还剩多少钱，值不值得备 50 件。
          </p>
        </section>
      </article>
    </main>
  );
}
