import { NextResponse } from "next/server";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { invalidateFeedCategoriesCache } from "@/lib/cache-tags";

function toSlug(name: string) {
  const s = slugify(name.trim(), { lower: true, strict: true, locale: "ru" });
  return s || "category";
}

export async function GET() {
  const rows = await prisma.postCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
  } | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Укажите название" }, { status: 400 });
  }
  const name = body.name.trim();
  const base = body.slug?.trim() ? toSlug(body.slug) : toSlug(name);
  let slug = base;
  let n = 2;
  while (
    await prisma.postCategory.findUnique({ where: { slug }, select: { id: true } })
  ) {
    slug = `${base}-${n}`;
    n += 1;
  }
  const maxOrder = await prisma.postCategory.aggregate({
    _max: { sortOrder: true },
  });
  const row = await prisma.postCategory.create({
    data: {
      name,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  invalidateFeedCategoriesCache();
  return NextResponse.json(row);
}
