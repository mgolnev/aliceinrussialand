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
  const post = await prisma.post.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
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
    images,
  };

  return <PostEditor initial={initial} siteUrl={siteUrl} />;
}
