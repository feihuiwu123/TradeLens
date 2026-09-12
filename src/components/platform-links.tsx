import { ExternalLink } from "lucide-react";
import type { MarketplaceLink } from "@/lib/marketplace-urls";

/**
 * 平台外链。
 *
 * kind=search 的链接会标注「搜」字，因为它指向的是一堆商品而不是某个具体商品——
 * 不加区分地展示会让用户以为页面上的价格来自这个链接。
 */
export function PlatformLinks({
  links,
  title,
  compact = false,
}: {
  links: MarketplaceLink[];
  title?: string;
  compact?: boolean;
}) {
  if (links.length === 0) return null;

  return (
    <div>
      {title ? <p className="mb-1.5 text-xs font-bold text-slate-400">{title}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <a
            key={`${l.platform}-${l.url}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={
              l.kind === "search"
                ? `在 ${l.platform} 搜索（结果为多个商品，不是本页数据的来源）`
                : `${l.platform} 商品页`
            }
            className={`inline-flex items-center gap-1 rounded-lg border transition hover:brightness-125 ${
              l.side === "sourcing"
                ? "border-sky-500/30 bg-sky-400/10 text-sky-300"
                : "border-amber-500/30 bg-amber-400/10 text-amber-200"
            } ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}`}
          >
            {l.label}
            {l.kind === "search" ? <span className="opacity-50">搜</span> : null}
            {!l.verified ? <span className="opacity-50" title="链接模式未实测">?</span> : null}
            <ExternalLink size={compact ? 9 : 11} className="opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}
