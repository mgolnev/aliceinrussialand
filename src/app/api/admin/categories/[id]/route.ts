import { NextResponse } from "next/server";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { invalidateFeedCategoriesCache } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ id: string }> };

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

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.postCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      slug?: string;
      description?: string;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }
    let name = existing.name;
    if (typeof body.name === "string") {
      const t = body.name.trim();
      if (!t) {
        return NextResponse.json({ error: "Укажите название" }, { status: 400 });
      }
      name = t;
    }
    let slug = existing.slug;
    if (typeof body.slug === "string" && body.slug.trim()) {
      slug = toSlug(body.slug);
    } else if (typeof body.name === "string") {
      slug = toSlug(name);
    }
    if (slug !== existing.slug) {
      let unique = slug;
      let n = 2;
      while (
        await prisma.postCategory.findFirst({
          where: { slug: unique, NOT: { id } },
          select: { id: true },
        })
      ) {
        unique = `${slug}-${n}`;
        n += 1;
      }
      slug = unique;
    }
    let description = existing.description;
    if (typeof body.description === "string") {
      description = body.description.trim();
    }
    let row;
    try {
      row = await prisma.postCategory.update({
        where: { id },
        data: { name, slug, description },
      });
    } catch (error) {
      if (!isUnknownDescriptionArg(error)) throw error;
      // Dev-safe fallback: old generated Prisma Client without `description`.
      row = await prisma.postCategory.update({
        where: { id },
        data: { name, slug },
      });
      const hasDescriptionColumn = await prisma.$queryRawUnsafe<
        Array<{ exists: boolean }>
      >(
        'SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2) AS "exists"',
        "PostCategory",
        "description",
      );
      if (!hasDescriptionColumn[0]?.exists) {
        throw new Error(
          'Поле "description" отсутствует в таблице PostCategory. Примените миграции Prisma.',
        );
      }
      await prisma.$executeRawUnsafe(
        'UPDATE "PostCategory" SET "description" = $1 WHERE "id" = $2',
        description,
        id,
      );
    }
    invalidateFeedCategoriesCache();
    return NextResponse.json({ ...row, description });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ошибка сохранения";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.postCategory.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  invalidateFeedCategoriesCache();
  return NextResponse.json({ ok: true });
}
