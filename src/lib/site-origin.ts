export function resolveSiteOrigin(siteUrl?: string | null): string {
  const fromSettings = normalizeOrigin(siteUrl);
  if (fromSettings) return fromSettings;

  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) return fromEnv;

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const fromVercel = normalizeOrigin(vercelHost ? `https://${vercelHost}` : "");
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
