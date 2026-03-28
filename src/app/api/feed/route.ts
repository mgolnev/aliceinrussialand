import { NextResponse } from "next/server";
import { getFeedPage } from "@/lib/feed-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const category = searchParams.get("category")?.trim() || undefined;
  const { items, nextCursor, categories } = await getFeedPage(cursor, category);

  const headers = new Headers();
  if (!cursor) {
    headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  } else {
    headers.set(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=600",
    );
  }

  return NextResponse.json({ items, nextCursor, categories }, { headers });
}
