import { prisma } from "@/lib/prisma";
import { ProjectsPanel } from "@/components/admin/ProjectsPanel";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { posts: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Подборки работ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Объединяйте публикации об одной работе. Они будут показаны вместе и первыми в рекомендациях друг друга.
        </p>
      </div>
      <ProjectsPanel initial={projects} />
    </div>
  );
}
