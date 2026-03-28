import { NextResponse } from "next/server";
import { getFeedPage } from "@/lib/feed-server";

/**
 * Без статического кэша на CDN: иначе после правки поста клиентский merge ленты
 * (alice-feed-refresh) на проде получал устаревший JSON и затирал свежие данные.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const category = searchParams.get("category")?.trim() || undefined;
  const { items, nextCursor, categories } = await getFeedPage(cursor, category);

  const headers = new Headers();
  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );

  return NextResponse.json({ items, nextCursor, categories }, { headers });
}
