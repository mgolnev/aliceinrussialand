/** Google и Яндекс допускают не более 1000 изображений на один URL sitemap. */
export const MAX_SITEMAP_IMAGES_PER_PAGE = 1000;
/** Sitemap protocol требует, чтобы полный URL был короче 2048 символов. */
export const MAX_SITEMAP_URL_LENGTH = 2048;

type SitemapImage = {
  variantsJson: string;
};

function preferredVariants(variantsJson: string): string[] {
  try {
    const parsed = JSON.parse(variantsJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    const variants = parsed as Record<string, unknown>;
    const preferred: string[] = [];
    for (const key of ["w1280", "w960", "w640", "w512"]) {
      const value = variants[key];
      if (typeof value === "string" && value.trim()) {
        preferred.push(value.trim());
      }
    }
    return preferred;
  } catch {
    /* Поврежденная запись не должна ломать весь sitemap. */
  }

  return [];
}

export function normalizeImageUrlForSitemap(
  siteUrl: string,
  imagePath: string,
): string | null {
  const raw = imagePath.trim();
  if (!raw) return null;

  // Если схема указана явно, не превращаем неподдерживаемый URL в локальный путь.
  const explicitScheme = raw.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    return null;
  }

  try {
    const parsed = explicitScheme
      ? new URL(raw)
      : new URL(raw, `${siteUrl.replace(/\/$/, "")}/`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    const normalized = parsed.toString();
    return normalized.length < MAX_SITEMAP_URL_LENGTH ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Для sitemap указываем одну стабильную, максимально качественную версию
 * каждого изображения. Responsive-варианты остаются на самой HTML-странице.
 */
export function imageUrlsForSitemap(
  siteUrl: string,
  images: SitemapImage[],
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const image of images) {
    if (urls.length >= MAX_SITEMAP_IMAGES_PER_PAGE) break;
    const url = preferredVariants(image.variantsJson)
      .map((variant) => normalizeImageUrlForSitemap(siteUrl, variant))
      .find((candidate): candidate is string => Boolean(candidate));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}
