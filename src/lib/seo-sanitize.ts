/**
 * Убирает эмодзи и служебные символы для SEO-сниппетов (не для текста поста на экране).
 */
export function stripEmojiForSeo(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\u200D/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
