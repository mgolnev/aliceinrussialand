/**
 * Приводит выбор публикаций из формы к уникальному упорядоченному списку.
 * Порядок намеренно сохраняется: он становится порядком чтения внутри цикла.
 */
export function normalizeProjectPostIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (typeof row !== "string") return null;
    const id = row.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
