/** Публичные переменные для Supabase Auth в браузере и в SSR (anon / publishable). */
export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

/** Поддержка и классического anon, и ключа «Publishable» из нового дашборда Supabase. */
export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    ""
  );
}

export function isSupabaseBrowserAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
