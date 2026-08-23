import {
  fallbackSitemapIndexEntries,
  loadSitemapIndexEntries,
} from "@/lib/sitemap-data";
import { serializeSitemapIndex, sitemapXmlResponse } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return sitemapXmlResponse(
      serializeSitemapIndex(await loadSitemapIndexEntries()),
    );
  } catch {
    // Контракт остаётся индексом; дочерний fallback не обращается к БД.
    return sitemapXmlResponse(
      serializeSitemapIndex(fallbackSitemapIndexEntries()),
    );
  }
}
