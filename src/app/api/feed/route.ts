import { NextResponse } from "next/server";
import { getFeedPage } from "@/lib/feed-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const { items, nextCursor } = await getFeedPage(cursor);
  return NextResponse.json({ items, nextCursor });
}
