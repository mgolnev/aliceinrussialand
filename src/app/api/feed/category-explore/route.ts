import { NextResponse } from "next/server";
import { getCategoryFeedExplore } from "@/lib/category-feed-explore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim() || "";
  if (!category) {
    return NextResponse.json({ error: "category required" }, { status: 400 });
  }

  const payload = await getCategoryFeedExplore(category);
  if (!payload) {
    return NextResponse.json(
      { error: "unknown category" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const headers = new Headers();
  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );

  return NextResponse.json(payload, { headers });
}
