import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { draftSlug } from "@/lib/slug";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q")?.trim() ?? "";

  const posts = await prisma.post.findMany({
    where: {
      ...(status === "DRAFT" || status === "PUBLISHED"
        ? { status }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { slug: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, select: { id: true } },
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
      imageCount: p.images.length,
    })),
  });
}

export async function POST() {
  const post = await prisma.post.create({
    data: {
      title: "Новая публикация",
      slug: draftSlug(),
      displayMode: "GRID",
      status: POST_STATUS.DRAFT,
    },
  });
  return NextResponse.json({ id: post.id, slug: post.slug });
}
