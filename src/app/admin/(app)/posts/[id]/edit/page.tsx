import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseVariants } from "@/lib/posts-query";
import { getSiteSettings } from "@/lib/site";
import {
  PostEditor,
  type EditorImage,
  type EditorPost,
} from "@/components/admin/PostEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const [post, categories] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.postCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  if (!post) notFound();

  const settings = await getSiteSettings();
  const siteUrl =
    settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const images: EditorImage[] = post.images.map((im) => ({
    id: im.id,
    sortOrder: im.sortOrder,
    caption: im.caption,
    alt: im.alt,
    variants: parseVariants(im.variantsJson),
    width: im.width,
    height: im.height,
  }));

  const initial: EditorPost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    body: post.body,
    displayMode: post.displayMode === "STACK" ? "STACK" : "GRID",
    status: post.status,
    pinned: post.pinned,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    telegramSourceUrl: post.telegramSourceUrl,
    locale: post.locale,
    categoryId: post.categoryId,
    images,
  };

  return (
    <PostEditor initial={initial} siteUrl={siteUrl} categories={categories} />
  );
}
