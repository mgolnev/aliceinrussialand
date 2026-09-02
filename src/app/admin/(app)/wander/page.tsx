import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site";
import { WanderSettingsForm } from "@/components/admin/WanderSettingsForm";

export default async function AdminWanderPage() {
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    prisma.postCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        isArchived: true,
        includeInWander: true,
        _count: {
          select: {
            posts: {
              where: { status: "PUBLISHED", images: { some: {} } },
            },
          },
        },
      },
    }),
  ]);
  const excludedCategoryIds = categories
    .filter((category) => !category.includeInWander)
    .map((category) => category.id);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Прогулка</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Управляйте входом в режим и тем, из каких категорий он может выбирать публикации.
        </p>
      </header>
      <WanderSettingsForm
        initialShowWanderEntry={settings.showWanderEntry}
        initialEntryLabel={settings.wanderEntryLabel}
        initialExcludedCategoryIds={excludedCategoryIds}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          isArchived: category.isArchived,
          eligiblePostCount: category._count.posts,
        }))}
      />
    </div>
  );
}
