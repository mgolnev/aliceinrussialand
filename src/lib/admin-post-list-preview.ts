import { extractFirstSentence } from "@/lib/post-text";

/**
 * Одна строка для списка в админке: без дубля «заголовок = первое предложение тела».
 * Приоритет — начало текста поста; заголовок только если тела нет.
 */
export function adminPostListPreview(title: string, body: string): string {
  const bodyClean = body.replace(/\s+/g, " ").trim();
  if (bodyClean) {
    return extractFirstSentence(bodyClean) || bodyClean.slice(0, 160);
  }
  const t = title?.trim();
  if (t) return t;
  return "Без текста";
}
