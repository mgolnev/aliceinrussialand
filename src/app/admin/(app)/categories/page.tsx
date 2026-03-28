import { prisma } from "@/lib/prisma";
import { CategoriesPanel } from "@/components/admin/CategoriesPanel";

export default async function AdminCategoriesPage() {
  const rows = await prisma.postCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Категории ленты
      </h1>
      <CategoriesPanel initial={rows} />
    </div>
  );
}
