import Link from "next/link";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
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

export function SeoPostList({ items, emptyText }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-2 text-xs text-stone-500">
            {formatDate(item.publishedAt ?? item.updatedAt)}
          </p>
          <Link href={`/p/${item.slug}`} className="text-base font-semibold text-stone-900">
            {item.title.trim() || "Публикация"}
          </Link>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {excerptForMetaDescription(item.body, 180) || "Откройте публикацию, чтобы прочитать полностью."}
          </p>
        </li>
      ))}
    </ul>
  );
}

