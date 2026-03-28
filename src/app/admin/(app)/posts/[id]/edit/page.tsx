import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site";
import { PostMetaEditor } from "@/components/admin/PostMetaEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      metaTitle: true,
      metaDescription: true,
      status: true,
    },
  });
  if (!post) notFound();

  const settings = await getSiteSettings();
  const siteUrl =
    settings.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  return (
    <PostMetaEditor
      initial={{
        id: post.id,
        slug: post.slug,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        status: post.status,
      }}
      siteUrl={siteUrl}
    />
  );
}
