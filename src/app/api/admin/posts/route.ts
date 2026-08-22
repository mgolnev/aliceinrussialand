import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { draftSlug } from "@/lib/slug";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q")?.trim() ?? "";

  // По одному символу совпадений слишком много, а форма всё равно предназначена
  // для точечного добавления публикации в подборку.
  if (q && q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const posts = await prisma.post.findMany({
    where: {
      ...(status === "DRAFT" || status === "PUBLISHED"
        ? { status }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: q ? 20 : 100,
    select: {
      id: true,
      slug: true,
      title: true,
      displayMode: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { images: true } },
    },
  });

  return NextResponse.json({
    items: posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      displayMode: p.displayMode,
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      imageCount: p._count.images,
    })),
  });
}

export async function POST() {
  const post = await prisma.post.create({
    data: {
      // Не создаём больше публично бессмысленный заголовок «Новая публикация».
      title: "Черновик",
      slug: draftSlug(),
      displayMode: "GRID",
      status: POST_STATUS.DRAFT,
    },
  });
  revalidatePath("/admin/posts");
  return NextResponse.json({ id: post.id, slug: post.slug });
}
