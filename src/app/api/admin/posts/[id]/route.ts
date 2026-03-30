import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { toSlug } from "@/lib/slug";
import { deleteImageFiles } from "@/lib/image-pipeline";
import { parseVariants } from "@/lib/posts-query";
import { derivePostTitle } from "@/lib/post-text";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";

type Ctx = { params: Promise<{ id: string }> };

async function ensureUniqueSlug(base: string, id: string) {
  const safeBase = toSlug(base) || `post-${id.slice(0, 6)}`;
  let slug = safeBase;
  let n = 2;

  while (
    await prisma.post.findFirst({
      where: {
        slug,
        NOT: { id },
      },
      select: { id: true },
    })
  ) {
    slug = `${safeBase}-${n}`;
    n += 1;
  }

  return slug;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({
    ...post,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    images: post.images.map((im) => ({
      ...im,
      variants: parseVariants(im.variantsJson),
    })),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const nextTitle =
    typeof body.title === "string"
      ? derivePostTitle(body.title, typeof body.body === "string" ? body.body : existing.body)
      : existing.title;
  const rawSlug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  const shouldRegenerateSlug =
    rawSlug === "" ||
    (rawSlug === undefined &&
      (existing.slug.startsWith("draft-") || existing.slug.startsWith("post-")) &&
      typeof body.title === "string" &&
      body.title.trim() !== existing.title);
  const slug =
    rawSlug !== undefined && rawSlug !== ""
      ? await ensureUniqueSlug(rawSlug, id)
      : shouldRegenerateSlug
        ? await ensureUniqueSlug(nextTitle, id)
        : undefined;

  const status =
    body.status === POST_STATUS.DRAFT || body.status === POST_STATUS.PUBLISHED
      ? body.status
      : undefined;

  let publishedAt = existing.publishedAt;
  if (status === POST_STATUS.PUBLISHED) {
    if (!publishedAt) {
      publishedAt = new Date();
    }
  } else if (status === POST_STATUS.DRAFT) {
    publishedAt = null;
  }

  const data: {
    title?: string;
    body?: string;
    slug?: string;
    displayMode?: string;
    status?: string;
    publishedAt?: Date | null;
    pinned?: boolean;
    metaTitle?: string;
    metaDescription?: string;
    telegramSourceUrl?: string | null;
    locale?: string;
    categoryId?: string | null;
  } = {};

  const nextBody =
    typeof body.body === "string" ? body.body : existing.body;
  const rawMetaTitle =
    typeof body.metaTitle === "string" ? body.metaTitle.trim() : undefined;
  const rawMetaDescription =
    typeof body.metaDescription === "string"
      ? body.metaDescription.trim()
      : undefined;

  if (typeof body.title === "string") data.title = nextTitle;
  if (typeof body.body === "string") data.body = nextBody;
  if (slug) data.slug = slug;
  if (body.displayMode === "GRID" || body.displayMode === "STACK") {
    data.displayMode = body.displayMode;
  }
  if (status) data.status = status;
  if (publishedAt !== undefined) data.publishedAt = publishedAt;
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body.metaTitle === "string") {
    data.metaTitle = rawMetaTitle || nextTitle;
  }
  if (typeof body.metaDescription === "string") {
    data.metaDescription =
      rawMetaDescription || excerptForMetaDescription(nextBody);
  }
  if (typeof body.telegramSourceUrl === "string") {
    data.telegramSourceUrl = body.telegramSourceUrl || null;
  }
  if (typeof body.locale === "string") data.locale = body.locale;

  if ("categoryId" in body) {
    if (body.categoryId === null) {
      data.categoryId = null;
    } else if (typeof body.categoryId === "string") {
      const cat = await prisma.postCategory.findUnique({
        where: { id: body.categoryId },
        select: { id: true },
      });
      if (cat) data.categoryId = cat.id;
    }
  }

  try {
    if (Object.keys(data).length > 0) {
      await prisma.post.update({
        where: { id },
        data,
      });
    }

    const imagesPayload = body.images as
      | Array<{
          id: string;
          sortOrder: number;
          caption?: string;
          alt?: string;
        }>
      | undefined;

    if (Array.isArray(imagesPayload) && imagesPayload.length > 0) {
      await prisma.$transaction(
        imagesPayload.map((row) =>
          prisma.postImage.update({
            where: { id: row.id, postId: id },
            data: {
              sortOrder: row.sortOrder,
              caption:
                typeof row.caption === "string" ? row.caption : undefined,
              alt: typeof row.alt === "string" ? row.alt : undefined,
            },
          }),
        ),
      );
    }

    const fresh = await prisma.post.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      ...fresh,
      publishedAt: fresh?.publishedAt?.toISOString() ?? null,
      images:
        fresh?.images.map((im) => ({
          ...im,
          variants: parseVariants(im.variantsJson),
        })) ?? [],
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Пост уже удалён" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  for (const im of post.images) {
    await deleteImageFiles(post.id, im.id);
  }

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
