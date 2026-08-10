const PRODUCTION_SITE_ORIGIN = "https://aliceinrussialand.ru";

export function resolveSiteOrigin(siteUrl?: string | null): string {
  const fromSettings = normalizeOrigin(siteUrl);
  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const fromVercel = normalizeOrigin(vercelHost ? `https://${vercelHost}` : "");

  // В production никогда не публикуем localhost/private origins в canonical и sitemap.
  // Старое значение в БД или окружении не должно ломать индексацию сайта.
  if (fromSettings && isPublicOrigin(fromSettings)) return fromSettings;
  if (fromEnv && isPublicOrigin(fromEnv)) return fromEnv;
  if (fromVercel && isPublicOrigin(fromVercel)) return fromVercel;

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_ORIGIN;
  }

  if (fromSettings) return fromSettings;
  if (fromEnv) return fromEnv;
  if (fromVercel) return fromVercel;

  return "http://localhost:3000";
}

function normalizeOrigin(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function isPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}
