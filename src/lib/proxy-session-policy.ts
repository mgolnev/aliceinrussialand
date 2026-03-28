/**
 * Обновление сессии Supabase в proxy дорогое — вызываем только там,
 * где есть интеграция или признаки сессии в куках.
 */
export function shouldAttemptSupabaseSessionRefresh(
  pathname: string,
  cookieNames: string[],
  supabaseBrowserAuthConfigured: boolean,
): boolean {
  if (!supabaseBrowserAuthConfigured) return false;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return cookieNames.some((n) => n.startsWith("sb-"));
}
