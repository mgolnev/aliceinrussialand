function decodeKnownHtmlEntities(value: string): string {
  return value
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Оставляет один читаемый суффикс с именем автора. Старые meta title нередко
 * уже заканчиваются именем, а layout раньше добавлял его второй раз.
 */
export function buildSeoDocumentTitle(raw: string, authorName: string): string {
  let title = decodeKnownHtmlEntities(raw).replace(/\s+/g, " ").trim();

  // У «Набросков ручкой» в базе оказалась одиночная HTML-кавычка в конце.
  // Парные кавычки в нормальном названии сохраняем.
  const doubleQuoteCount = (title.match(/"/g) ?? []).length;
  if (doubleQuoteCount % 2 === 1) title = title.replace(/"+\s*$/u, "").trim();

  const author = authorName.replace(/\s+/g, " ").trim();
  if (!author) return title;

  const suffix = new RegExp(
    `\\s*(?:[|·—–-])\\s*${escapeRegExp(author)}\\s*$`,
    "iu",
  );
  let base = title;
  while (suffix.test(base)) {
    const withoutAuthor = base.replace(suffix, "").trim();
    if (!withoutAuthor) break;
    base = withoutAuthor;
  }

  if (!base) return author;
  if (base.localeCompare(author, "ru", { sensitivity: "accent" }) === 0) return author;
  return `${base} | ${author}`;
}
