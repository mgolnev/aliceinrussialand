import Link from "next/link";
import { getSiteSettings } from "@/lib/site";
import { listSeoCategories } from "@/lib/seo-content";

const PRIMARY_CATEGORY_NAMES = [
  "Керамика",
  "Наброски",
  "Выставки",
  "Иллюстрация",
  "#Это другое",
] as const;

function normalizeCategoryName(value: string): string {
  return value.replace(/^#\s*/u, "").trim().toLowerCase();
}

const PRIMARY_CATEGORY_NAME_SET = new Set(
  PRIMARY_CATEGORY_NAMES.map((name) => normalizeCategoryName(name)),
);

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const siteContext = [settings.tagline, settings.bio].filter(Boolean).join(" ");
  const categories = await listSeoCategories(siteContext);
  const footerCategories = categories.filter((category) =>
    PRIMARY_CATEGORY_NAME_SET.has(normalizeCategoryName(category.name)),
  );

  return (
    <footer className="mt-14 border-t border-stone-200/70 bg-white/65 py-10 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 sm:px-5">
        {footerCategories.length > 0 ? (
          <nav aria-label="Темы" className="text-sm text-stone-600">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Темы
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {footerCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="underline decoration-stone-300 underline-offset-2 hover:text-stone-800"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        <p className="text-center text-sm text-stone-500">
          © {new Date().getFullYear()} · авторская лента
        </p>
      </div>
    </footer>
  );
}
