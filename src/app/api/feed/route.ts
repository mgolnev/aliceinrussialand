import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFeedPage } from "@/lib/feed-server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Без статического кэша на CDN: иначе после правки поста клиентский merge ленты
 * (alice-feed-refresh) на проде получал устаревший JSON и затирал свежие данные.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const category = searchParams.get("category")?.trim() || undefined;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAdmin = session ? await verifySessionToken(session) : false;
  const { items, nextCursor, categories } = await getFeedPage(
    cursor,
    category,
    isAdmin ? "admin" : "public",
  );

  const headers = new Headers();
  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );

  return NextResponse.json({ items, nextCursor, categories }, { headers });
}
