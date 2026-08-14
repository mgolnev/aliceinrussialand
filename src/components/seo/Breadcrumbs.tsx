import Link from "next/link";
import { absoluteUrl } from "@/lib/absolute-url";

type BreadcrumbItem = {
  name: string;
  /**
   * The last item is deliberately not linked: it describes the page the
   * visitor is already on. All preceding items are regular crawlable links.
   */
  href?: string;
};

type Props = {
  items: BreadcrumbItem[];
  siteUrl: string;
  className?: string;
};

function jsonLdValue(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Visible site navigation plus the BreadcrumbList JSON-LD used by Yandex and
 * other search engines. Keep this list short: a page belongs to a maximum of
 * one category, so it never exceeds three levels.
 */
export function Breadcrumbs({ items, siteUrl, className = "" }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: absoluteUrl(siteUrl, item.href) } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdValue(jsonLd) }}
      />
      <nav
        aria-label="Навигационная цепочка"
        className={`flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-stone-500 ${className}`}
      >
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <span key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span aria-hidden className="text-stone-300">/</span> : null}
              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="shrink-0 underline decoration-stone-300 underline-offset-2 hover:text-stone-800"
                >
                  {item.name}
                </Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined} className="truncate text-stone-600">
                  {item.name}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
