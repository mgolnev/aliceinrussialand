import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateFeedCategoriesCache } from "@/lib/cache-tags";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    ids?: string[];
  } | null;
  if (!body?.ids?.length) {
    return NextResponse.json({ error: "Передайте ids" }, { status: 400 });
  }
  await prisma.$transaction(
    body.ids.map((id, index) =>
      prisma.postCategory.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  invalidateFeedCategoriesCache();
  return NextResponse.json({ ok: true });
}
