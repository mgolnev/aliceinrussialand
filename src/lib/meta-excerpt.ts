const DEFAULT_MAX = 160;

/** Сжимает пробелы и даёт короткий фрагмент для meta description (по возможности не рвёт слово). */
export function excerptForMetaDescription(
  raw: string,
  maxLen: number = DEFAULT_MAX,
): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const slice = normalized.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.25) {
    return slice.slice(0, lastSpace).trimEnd();
  }
  return slice.trimEnd();
}
