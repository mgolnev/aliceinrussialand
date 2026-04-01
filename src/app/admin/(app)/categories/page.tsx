import { prisma } from "@/lib/prisma";
import { CategoriesPanel } from "@/components/admin/CategoriesPanel";

export default async function AdminCategoriesPage() {
  const rows = await prisma.postCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Категории ленты</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Порядок вкладок в ленте совпадает с порядком строк ниже. Пост без
          категории виден только во «Все».
        </p>
      </div>
      <CategoriesPanel initial={rows} />
    </div>
  );
}
