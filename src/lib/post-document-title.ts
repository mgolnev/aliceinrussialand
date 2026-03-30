/**
 * Заголовок вкладки / сниппета, когда автор не задал metaTitle.
 * Добавляем рубрику и имя сайта только если их ещё нет в тексте заголовка
 * (избегаем «Имя · Имя»).
 */
export function buildImplicitPostDocumentTitle(
  postTitle: string,
  siteDisplayName: string,
  categoryName: string | null | undefined,
): string {
  const main = postTitle.trim() || "Публикация";
  const site = siteDisplayName.trim();
  const cat = categoryName?.trim();
  const lower = main.toLowerCase();
  const mainHasSite = Boolean(site && lower.includes(site.toLowerCase()));
  const mainHasCat = Boolean(cat && lower.includes(cat.toLowerCase()));

  const mid = cat && !mainHasCat ? cat : null;
  const suffix = site && !mainHasSite ? site : null;

  if (mid && suffix) return `${main} · ${mid} | ${suffix}`;
  if (mid) return `${main} · ${mid}`;
  if (suffix) return `${main} | ${suffix}`;
  return main;
}
