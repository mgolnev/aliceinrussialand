import { MAX_SITEMAP_URL_LENGTH } from "./image-sitemap";

export type SitemapUrlEntry = {
  url: string;
  lastModified?: string | Date;
  images?: string[];
};

export type SitemapIndexEntry = {
  url: string;
  lastModified?: string | Date;
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
export const MAX_SITEMAP_ENTRIES = 50_000;
export const MAX_SITEMAP_XML_BYTES = 50 * 1024 * 1024;

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function serializedDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function validLoc(value: string): boolean {
  if (value.length >= MAX_SITEMAP_URL_LENGTH) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function finishXml(lines: string[], entryCount: number): string {
  if (entryCount > MAX_SITEMAP_ENTRIES) {
    throw new Error("Sitemap exceeds the 50,000 entry limit");
  }
  const xml = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(xml).byteLength > MAX_SITEMAP_XML_BYTES) {
    throw new Error("Sitemap exceeds the 50 MB uncompressed size limit");
  }
  return xml;
}

export function serializeUrlSet(entries: SitemapUrlEntry[]): string {
  const validEntries = entries.filter((entry) => validLoc(entry.url));
  const hasImages = validEntries.some((entry) =>
    entry.images?.some(validLoc),
  );
  const namespace = hasImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";
  const lines = [
    XML_DECLARATION,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${namespace}>`,
  ];

  for (const entry of validEntries) {
    lines.push("<url>", `<loc>${escapeXml(entry.url)}</loc>`);
    for (const image of (entry.images ?? []).filter(validLoc)) {
      lines.push(
        "<image:image>",
        `<image:loc>${escapeXml(image)}</image:loc>`,
        "</image:image>",
      );
    }
    if (entry.lastModified) {
      lines.push(
        `<lastmod>${escapeXml(serializedDate(entry.lastModified))}</lastmod>`,
      );
    }
    lines.push("</url>");
  }

  lines.push("</urlset>");
  return finishXml(lines, validEntries.length);
}

export function serializeSitemapIndex(entries: SitemapIndexEntry[]): string {
  const validEntries = entries.filter((entry) => validLoc(entry.url));
  const lines = [
    XML_DECLARATION,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of validEntries) {
    lines.push("<sitemap>", `<loc>${escapeXml(entry.url)}</loc>`);
    if (entry.lastModified) {
      lines.push(
        `<lastmod>${escapeXml(serializedDate(entry.lastModified))}</lastmod>`,
      );
    }
    lines.push("</sitemap>");
  }

  lines.push("</sitemapindex>");
  return finishXml(lines, validEntries.length);
}

export function sitemapXmlResponse(xml: string, status = 200): Response {
  return new Response(xml, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        status >= 500 ? "no-store" : "public, max-age=0, must-revalidate",
    },
  });
}
