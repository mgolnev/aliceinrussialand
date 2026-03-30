/** Единый вид ссылки на пост для сравнения с `Post.telegramSourceUrl`. */
export function normalizeTelegramPostUrl(url: string): string {
  let s = url.trim();
  while (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}
