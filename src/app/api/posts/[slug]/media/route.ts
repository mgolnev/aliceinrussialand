import { NextResponse } from "next/server";
import { getPublishedPostMediaBySlug } from "@/lib/posts-query";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const data = await getPublishedPostMediaBySlug(slug);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Cache-Control",
    "public, s-maxage=120, stale-while-revalidate=600",
  );

  return NextResponse.json(data, { headers });
}
