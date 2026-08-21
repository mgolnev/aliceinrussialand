import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site";
import { PostMetaEditor } from "@/components/admin/PostMetaEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const [post, aiJobs] = await Promise.all([
    prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      metaTitle: true,
      metaDescription: true,
      status: true,
    },
    }),
    prisma.aiSeoJob.findMany({
      where: { postId: id },
      orderBy: { updatedAt: "desc" },
      select: { status: true },
    }),
  ]);
  if (!post) notFound();

  const aiStatus = aiJobs.some((job) => job.status === "RUNNING")
    ? "RUNNING"
    : aiJobs.some((job) => job.status === "PENDING")
      ? "PENDING"
      : aiJobs.some((job) => job.status === "REVIEW")
        ? "REVIEW"
        : aiJobs.some((job) => job.status === "FAILED")
          ? "FAILED"
          : aiJobs.some((job) => job.status === "DONE")
            ? "DONE"
            : "IDLE";

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
        aiStatus,
      }}
      siteUrl={siteUrl}
    />
  );
}
