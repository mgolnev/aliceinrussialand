import {
  fallbackSitemapEntries,
  loadPagesSitemapEntries,
  loadPostSitemapEntries,
  POSTS_PER_IMAGE_SITEMAP,
} from "@/lib/sitemap-data";
import { serializeUrlSet, sitemapXmlResponse } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ name: string }> };

export async function GET(_request: Request, context: Context) {
  const { name } = await context.params;
  let loadEntries: (() => ReturnType<typeof loadPagesSitemapEntries>) | null =
    null;

  if (name === "pages.xml") {
    loadEntries = loadPagesSitemapEntries;
  } else if (name === "fallback.xml") {
    loadEntries = async () => fallbackSitemapEntries();
  } else if (name === "posts.xml") {
    const url = new URL(_request.url);
    const ids = url.searchParams.get("ids")?.split(",") ?? [];
    const validIds =
      ids.length > 0 &&
      ids.length <= POSTS_PER_IMAGE_SITEMAP &&
      new Set(ids).size === ids.length &&
      ids.every((id) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id));
    if (validIds) {
      loadEntries = () => loadPostSitemapEntries(ids);
    }
  }

  if (!loadEntries) {
    return new Response("Not found", { status: 404 });
  }

  try {
    return sitemapXmlResponse(serializeUrlSet(await loadEntries()));
  } catch {
    // Валидный XML и 503 позволяют роботу повторить запрос позже.
    return sitemapXmlResponse(serializeUrlSet([]), 503);
  }
}
