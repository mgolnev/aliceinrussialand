import Link from "next/link";

type Props = {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
};

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}?page=${page}`;
}

export function SeoPager({ basePath, page, total, pageSize }: Props) {
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));
  if (pagesCount <= 1) return null;

  const prev = page > 1 ? page - 1 : null;
  const next = page < pagesCount ? page + 1 : null;

  return (
    <nav aria-label="Пагинация архива" className="mt-6 flex items-center gap-4 text-sm">
      {prev ? (
        <Link href={pageHref(basePath, prev)} className="text-stone-700 underline">
          Предыдущая страница
        </Link>
      ) : (
        <span className="text-stone-400">Предыдущая страница</span>
      )}
      <span className="text-stone-500">
        Страница {page} из {pagesCount}
      </span>
      {next ? (
        <Link href={pageHref(basePath, next)} className="text-stone-700 underline">
          Следующая страница
        </Link>
      ) : (
        <span className="text-stone-400">Следующая страница</span>
      )}
    </nav>
  );
}

