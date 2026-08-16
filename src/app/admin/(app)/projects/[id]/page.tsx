import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectEditor } from "@/components/admin/ProjectEditor";
import { projectOrderMode } from "@/lib/project-order";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminProjectPage({ params }: PageProps) {
  const { id } = await params;
  const [project, posts] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        metaTitle: true,
        metaDescription: true,
        orderMode: true,
        status: true,
        posts: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { postId: true },
        },
      },
    }),
    prisma.post.findMany({
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
      },
    }),
  ]);
  if (!project) notFound();

  return (
    <ProjectEditor
      initial={{
        ...project,
        orderMode: projectOrderMode(project.orderMode),
        postIds: project.posts.map((row) => row.postId),
      }}
      posts={posts.map((post) => ({
        ...post,
        publishedAt: post.publishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
