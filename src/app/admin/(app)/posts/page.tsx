import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site";
import { parseVariants } from "@/lib/posts-query";
import { adminPostListPreview } from "@/lib/admin-post-list-preview";
import {
  AdminPostsList,
  type AdminPostListRow,
} from "@/components/admin/AdminPostsList";

function thumbUrlFromVariantsJson(variantsJson: string): string | null {
  const v = parseVariants(variantsJson);
  return (
    v.w320 ??
    v.w640 ??
    v.w960 ??
    v.w1280 ??
    Object.values(v).find((u) => typeof u === "string" && u.length > 0) ??
    null
  );
}

export default async function AdminPostsPage() {
  const [posts, settings, categories] = await Promise.all([
    prisma.post.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        _count: { select: { images: true } },
        category: { select: { name: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { variantsJson: true },
        },
      },
    }),
    getSiteSettings(),
    prisma.postCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, sortOrder: true },
    }),
  ]);

  const siteUrl =
    settings.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const rows: AdminPostListRow[] = posts.map((p) => {
    const first = p.images[0];
    const thumbUrl = first
      ? thumbUrlFromVariantsJson(first.variantsJson)
      : null;
    return {
      id: p.id,
      slug: p.slug,
      preview: adminPostListPreview(p.title, p.body),
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      imageCount: p._count.images,
      thumbUrl,
      categoryName: p.category?.name?.trim() || null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Посты</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Обзор последних записей: превью, статус и меню. Текст, фото, slug и
          SEO можно править прямо здесь (пункт «Редактировать») или в ленте на
          главной.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white/75 px-4 py-8 text-center text-[14px] leading-relaxed text-stone-500">
          Пока нет постов. Новую запись можно начать в ленте на главной.
        </div>
      ) : (
        <AdminPostsList posts={rows} siteUrl={siteUrl} categories={categories} />
      )}
    </div>
  );
}
