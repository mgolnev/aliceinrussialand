import Link from "next/link";
import { getSeoPostListPreviewParts } from "@/lib/seo-post-list-preview";
import type { SeoPostListItem } from "@/lib/seo-content";

type Props = {
  items: SeoPostListItem[];
  emptyText: string;
};

function formatDate(iso: Date | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(iso);
}

const cardClass =
  "block min-w-0 rounded-site-surface border border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm transition-[border-color,background-color] hover:border-stone-300/90 hover:bg-white sm:px-5 sm:py-4";

export function SeoPostList({ items, emptyText }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-site-panel border border-stone-200/80 bg-white/90 px-4 py-6 text-sm text-stone-600 ">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-4 sm:space-y-6">
      {items.map((item) => {
        const { heading, excerpt } = getSeoPostListPreviewParts(
          item.title,
          item.body,
        );
        const dateLine = formatDate(item.publishedAt ?? item.updatedAt);
        return (
          <li key={item.id}>
            <Link href={`/p/${item.slug}`} className={cardClass}>
              {dateLine ? (
                <time
                  className="block text-[13px] font-medium tabular-nums text-stone-400"
                  dateTime={
                    item.publishedAt?.toISOString() ?? item.updatedAt.toISOString()
                  }
                >
                  {dateLine}
                </time>
              ) : null}
              {heading ? (
                <p className="mt-2 text-lg font-semibold leading-snug tracking-tight text-stone-900 sm:text-xl sm:leading-tight">
                  {heading}
                </p>
              ) : null}
              <p
                className={`min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 sm:text-[16px] sm:leading-8 ${heading || dateLine ? "mt-2" : ""}`}
              >
                {excerpt}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
