import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/slug";
import { normalizeProjectPostIds } from "@/lib/project-post-ids";
import { PROJECT_STATUS } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

async function uniqueSlug(input: string, id: string) {
  const base = toSlug(input);
  let slug = base;
  let n = 2;
  while (
    await prisma.project.findFirst({
      where: { slug, NOT: { id } },
      select: { id: true },
    })
  ) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function revalidateProjectPages(projectSlugs: Iterable<string>, postSlugs: Iterable<string>) {
  for (const slug of new Set(projectSlugs)) revalidatePath(`/projects/${slug}`);
  for (const slug of new Set(postSlugs)) revalidatePath(`/p/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/projects");
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      posts: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { postId: true, sortOrder: true },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { posts: { select: { post: { select: { slug: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : existing.title;
  if (!title) return NextResponse.json({ error: "Укажите название подборки" }, { status: 400 });
  const status =
    body.status === PROJECT_STATUS.DRAFT ||
    body.status === PROJECT_STATUS.PUBLISHED ||
    body.status === PROJECT_STATUS.ARCHIVED
      ? body.status
      : existing.status;
  const postIds = "postIds" in body ? normalizeProjectPostIds(body.postIds) : undefined;
  if (postIds === null) {
    return NextResponse.json({ error: "Некорректный список публикаций" }, { status: 400 });
  }

  const selectedPosts = postIds
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, slug: true },
      })
    : [];
  if (postIds && selectedPosts.length !== postIds.length) {
    return NextResponse.json({ error: "Одна из выбранных публикаций больше не существует" }, { status: 400 });
  }
  const nextPostCount = postIds === undefined ? existing.posts.length : postIds.length;
  if (status === PROJECT_STATUS.PUBLISHED && nextPostCount < 2) {
    return NextResponse.json(
      { error: "Чтобы опубликовать подборку, добавьте минимум две публикации" },
      { status: 400 },
    );
  }

  const slug =
    typeof body.slug === "string" && body.slug.trim()
      ? await uniqueSlug(body.slug, id)
      : typeof body.title === "string"
        ? await uniqueSlug(title, id)
        : existing.slug;
  const description =
    typeof body.description === "string" ? body.description.trim() : existing.description;
  const metaTitle =
    typeof body.metaTitle === "string" ? body.metaTitle.trim() : existing.metaTitle;
  const metaDescription =
    typeof body.metaDescription === "string"
      ? body.metaDescription.trim()
      : existing.metaDescription;

  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: { title, slug, description, metaTitle, metaDescription, status },
    });
    if (postIds !== undefined) {
      await tx.postProject.deleteMany({ where: { projectId: id } });
      if (postIds.length) {
        await tx.postProject.createMany({
          data: postIds.map((postId, sortOrder) => ({ projectId: id, postId, sortOrder })),
        });
      }
    }
    return updated;
  });

  revalidateProjectPages(
    [existing.slug, project.slug],
    [...existing.posts.map((row) => row.post.slug), ...selectedPosts.map((post) => post.slug)],
  );
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { posts: { select: { post: { select: { slug: true } } } } },
  });
  if (!project) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  revalidateProjectPages([project.slug], project.posts.map((row) => row.post.slug));
  return NextResponse.json({ ok: true });
}
