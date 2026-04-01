export function resolveSiteOrigin(siteUrl?: string | null): string {
  const fromSettings = normalizeOrigin(siteUrl);
  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const fromVercel = normalizeOrigin(vercelHost ? `https://${vercelHost}` : "");

  // In production we never want to emit localhost/private origins in canonical URLs.
  // Prefer explicit public env/vercel domain, and only then fallback to settings.
  if (fromSettings && isPublicOrigin(fromSettings)) return fromSettings;
  if (fromEnv) return fromEnv;
  if (fromVercel) return fromVercel;
  if (fromSettings) return fromSettings;

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
