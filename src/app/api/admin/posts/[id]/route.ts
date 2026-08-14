import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { toSlug } from "@/lib/slug";
import { deleteImageFiles } from "@/lib/image-pipeline";
import { parseVariants } from "@/lib/posts-query";
import { derivePostTitle } from "@/lib/post-text";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { normalizeProjectPostIds } from "@/lib/project-post-ids";

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

/** Сбрасывает публичные страницы, которые показывают изменённый пост. */
function revalidatePublicPostPages(slugs: Array<string | null | undefined>) {
  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidatePath(`/p/${slug}`);
  }
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/category/[slug]", "page");
}

function revalidateProjectPages(slugs: Iterable<string>) {
  for (const slug of new Set(slugs)) revalidatePath(`/projects/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: { select: { id: true, name: true, slug: true } },
      projects: {
        orderBy: { sortOrder: "asc" },
        include: { project: { select: { id: true, title: true, slug: true } } },
      },
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
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { projects: { include: { project: { select: { slug: true } } } } },
  });
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

  const requestedProjectIds =
    "projectIds" in body ? normalizeProjectPostIds(body.projectIds) : undefined;
  if (requestedProjectIds === null) {
    return NextResponse.json({ error: "Некорректный список подборок" }, { status: 400 });
  }
  const requestedProjects = requestedProjectIds
    ? await prisma.project.findMany({
        where: { id: { in: requestedProjectIds } },
        select: { id: true, slug: true },
      })
    : [];
  if (
    requestedProjectIds &&
    requestedProjects.length !== requestedProjectIds.length
  ) {
    return NextResponse.json({ error: "Одна из подборок больше не существует" }, { status: 400 });
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
    /** Снятие с публикации — дата обнуляется. Черновик → черновик: сохраняем дату (в т.ч. из импорта Telegram). */
    if (existing.status === POST_STATUS.PUBLISHED) {
      publishedAt = null;
    }
  }

  const data: {
    title?: string;
    body?: string;
    slug?: string;
    displayMode?: string;
    status?: string;
    publishedAt?: Date | null;
    pinned?: boolean;
    showInAll?: boolean;
    metaTitle?: string;
    metaDescription?: string;
    telegramSourceUrl?: string | null;
    sourcePlatform?: "TELEGRAM" | "INSTAGRAM" | "BEHANCE" | null;
    sourceUrl?: string | null;
    sourceExternalId?: string | null;
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
  if (
    body.sourcePlatform === "TELEGRAM" ||
    body.sourcePlatform === "INSTAGRAM" ||
    body.sourcePlatform === "BEHANCE" ||
    body.sourcePlatform === null
  ) {
    data.sourcePlatform = body.sourcePlatform;
  }
  if (typeof body.sourceUrl === "string") {
    data.sourceUrl = body.sourceUrl || null;
  }
  if (typeof body.sourceExternalId === "string") {
    data.sourceExternalId = body.sourceExternalId || null;
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
  if (typeof body.showInAll === "boolean") {
    const effectiveCategoryId =
      data.categoryId === undefined ? existing.categoryId : data.categoryId;
    if (!body.showInAll && !effectiveCategoryId) {
      return NextResponse.json(
        { error: "Сначала выберите категорию для поста" },
        { status: 400 },
      );
    }
    data.showInAll = body.showInAll;
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

    if (requestedProjectIds !== undefined) {
      const existingProjectIds = existing.projects.map((row) => row.projectId);
      const toRemove = existingProjectIds.filter(
        (projectId) => !requestedProjectIds.includes(projectId),
      );
      const toAdd = requestedProjectIds.filter(
        (projectId) => !existingProjectIds.includes(projectId),
      );
      const changedIds = [...toRemove, ...toAdd];
      if (changedIds.length) {
        await prisma.$transaction(async (tx) => {
          if (toRemove.length) {
            await tx.postProject.deleteMany({
              where: { postId: id, projectId: { in: toRemove } },
            });
          }
          for (const projectId of toAdd) {
            const maxOrder = await tx.postProject.aggregate({
              where: { projectId },
              _max: { sortOrder: true },
            });
            await tx.postProject.create({
              data: {
                postId: id,
                projectId,
                sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
              },
            });
          }
          await tx.project.updateMany({
            where: { id: { in: changedIds } },
            data: { updatedAt: new Date() },
          });
        });
      }
    }

    const fresh = await prisma.post.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
        projects: {
          orderBy: { sortOrder: "asc" },
          include: {
            project: { select: { id: true, title: true, slug: true, status: true } },
          },
        },
      },
    });

    revalidatePath("/admin/posts");
    revalidatePublicPostPages([existing.slug, fresh?.slug]);
    revalidateProjectPages([
      ...existing.projects.map((row) => row.project.slug),
      ...requestedProjects.map((project) => project.slug),
    ]);

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
  revalidatePath("/admin/posts");
  revalidatePublicPostPages([post.slug]);
  return NextResponse.json({ ok: true });
}
