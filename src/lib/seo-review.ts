export const SEO_REVIEW_PRIORITY = {
  CRITICAL: "CRITICAL",
  IMPROVE: "IMPROVE",
} as const;

export type SeoReviewPriority =
  (typeof SEO_REVIEW_PRIORITY)[keyof typeof SEO_REVIEW_PRIORITY];

export type PostSeoReviewAssessment = {
  priority: SeoReviewPriority | null;
  titleLength: number;
  descriptionLength: number;
  duplicateTitleCount: number;
  flags: string[];
};

export function compactSeoText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function buildSeoTitleDuplicateCounts(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = compactSeoText(value).toLocaleLowerCase("ru");
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

/**
 * Не считаем длину жёстким SEO-правилом: это только безопасный сигнал, что
 * title мог быть импортирован из Telegram, а description не объясняет работу.
 */
export function assessPostSeoForReview(input: {
  metaTitle: string;
  metaDescription: string;
  duplicateTitleCount: number;
}): PostSeoReviewAssessment {
  const title = compactSeoText(input.metaTitle);
  const description = compactSeoText(input.metaDescription);
  const titleLength = [...title].length;
  const descriptionLength = [...description].length;
  const flags: string[] = [];
  const genericTitle = title.toLocaleLowerCase("ru") === "новая публикация";

  if (!title) flags.push("Нет title");
  if (genericTitle) flags.push("Общий title «Новая публикация»");
  if (input.duplicateTitleCount > 1) {
    flags.push(`Дубликат title (${input.duplicateTitleCount})`);
  }
  if (title && titleLength < 25) flags.push("Title короче 25 знаков");
  if (titleLength > 70) flags.push("Title длиннее 70 знаков");
  if (!description) flags.push("Нет description");
  if (description && descriptionLength < 70) {
    flags.push("Description короче 70 знаков");
  }

  const critical = !title || genericTitle || input.duplicateTitleCount > 1;
  const improve = flags.length > 0;
  return {
    priority: critical
      ? SEO_REVIEW_PRIORITY.CRITICAL
      : improve
        ? SEO_REVIEW_PRIORITY.IMPROVE
        : null,
    titleLength,
    descriptionLength,
    duplicateTitleCount: input.duplicateTitleCount,
    flags,
  };
}

export function publishedProjectNeedsSeoReview(input: {
  status: string;
  metaTitle: string;
  metaDescription: string;
}): boolean {
  return (
    input.status === "PUBLISHED" &&
    (!compactSeoText(input.metaTitle) || !compactSeoText(input.metaDescription))
  );
}
