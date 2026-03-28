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
  const [posts, settings] = await Promise.all([
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

  return rows.length === 0 ? (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/75 px-4 py-8 text-center text-[14px] leading-relaxed text-stone-500">
      Пока нет постов. Новую запись можно начать в ленте на главной.
    </div>
  ) : (
    <AdminPostsList posts={rows} siteUrl={siteUrl} />
  );
}
