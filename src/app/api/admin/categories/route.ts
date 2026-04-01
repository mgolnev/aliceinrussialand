import { NextResponse } from "next/server";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { invalidateFeedCategoriesCache } from "@/lib/cache-tags";

function toSlug(name: string) {
  const s = slugify(name.trim(), { lower: true, strict: true, locale: "ru" });
  return s || "category";
}

function isUnknownDescriptionArg(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Unknown argument `description`") ||
    msg.includes("Unknown arg `description`")
  );
}

export async function GET() {
  const rows = await prisma.postCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      slug?: string;
      description?: string;
    } | null;
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "Укажите название" }, { status: 400 });
    }
    const name = body.name.trim();
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
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
    let row;
    try {
      row = await prisma.postCategory.create({
        data: {
          name,
          description,
          slug,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      if (!isUnknownDescriptionArg(error)) throw error;
      // Dev-safe fallback: old generated Prisma Client without `description`.
      row = await prisma.postCategory.create({
        data: {
          name,
          slug,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      await prisma.$executeRawUnsafe(
        'UPDATE "PostCategory" SET "description" = $1 WHERE "id" = $2',
        description,
        row.id,
      );
    }
    invalidateFeedCategoriesCache();
    return NextResponse.json({ ...row, description });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ошибка сохранения";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
