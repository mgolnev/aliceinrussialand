/**
 * Утилиты для управления состоянием навигации в новой системе скролла.
 */

const NAV_STATE_KEY = "alice:nav-state";

/**
 * Очищает состояние навигации при переходе на главную страницу.
 * Это гарантирует, что переход по логотипу всегда начинается с верха страницы.
 */
export function clearNavigationState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NAV_STATE_KEY);
  } catch {
    /* ignore */
  }
}