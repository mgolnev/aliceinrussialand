const SCROLL_KEY = "alice-feed-scroll-y";

/** Сохранить позицию прокрутки перед переходом на страницу поста с ленты. */
export function saveFeedScrollPosition() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
}

/**
 * Однократно прочитать сохранённую позицию (и удалить), чтобы восстановить на главной.
 */
export function consumeFeedScrollPosition(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SCROLL_KEY);
  if (raw == null) return null;
  sessionStorage.removeItem(SCROLL_KEY);
  const y = parseInt(raw, 10);
  return Number.isFinite(y) && y >= 0 ? y : null;
}
