import { NextResponse } from "next/server";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { invalidateFeedCategoriesCache } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ id: string }> };

function toSlug(name: string) {
  const s = slugify(name.trim(), { lower: true, strict: true, locale: "ru" });
  return s || "category";
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.postCategory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const name =
    typeof body.name === "string" ? body.name.trim() : existing.name;
  let slug = existing.slug;
  if (typeof body.slug === "string" && body.slug.trim()) {
    slug = toSlug(body.slug);
  } else if (typeof body.name === "string" && body.name.trim()) {
    slug = toSlug(body.name);
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
  const row = await prisma.postCategory.update({
    where: { id },
    data: { name, slug },
  });
  return NextResponse.json(row);
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
