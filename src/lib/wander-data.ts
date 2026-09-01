import { prisma } from "@/lib/prisma";
import { isSystemPostTitle, plainPostPreview } from "@/lib/post-text";
import type { WanderCatalogue, WanderPost } from "@/lib/wander";

function imageUrls(json: string): { src: string; thumbnail: string } | null {
  try {
    const variants = JSON.parse(json);
    const url = (key: string): string | undefined => {
      const value = variants?.[key];
      return typeof value === "string" && /^(https?:\/\/|\/(?!\/))/.test(value) ? value : undefined;
    };
    const src = url("w1280") || url("w960") || url("w640");
    return src ? { src, thumbnail: url("w640") || url("w960") || src } : null;
  } catch {
    return null;
  }
}

export async function getWanderCatalogue(): Promise<WanderCatalogue> {
  const rows = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { id: "asc" },
    select: {
      id: true, slug: true, title: true,
      _count: { select: { posts: { where: { post: { status: "PUBLISHED" } } } } },
      posts: {
        where: { post: { status: "PUBLISHED", images: { some: {} } } },
        orderBy: { postId: "asc" },
        select: {
          post: {
            select: {
              id: true, slug: true, title: true,
              images: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, variantsJson: true, alt: true, width: true, height: true },
              },
            },
          },
        },
      },
    },
  });
  const posts = new Map<string, WanderPost>();
  const projects: WanderCatalogue["projects"] = [];
  for (const row of rows) {
    // Match the public collection page's rule, including collections with text-only posts.
    if (row._count.posts < 2) continue;
    const postIds: string[] = [];
    for (const { post } of row.posts) {
      const images = post.images.flatMap((image) => {
        const urls = imageUrls(image.variantsJson);
        return urls ? [{
          id: image.id,
          ...urls,
          alt: image.alt.trim(),
          width: image.width,
          height: image.height,
        }] : [];
      });
      if (!images.length) continue;
      const title = plainPostPreview(isSystemPostTitle(post.title) ? images[0]!.alt || row.title : post.title).slice(0, 160);
      const existing = posts.get(post.id);
      if (existing) {
        existing.projectIds.push(row.id);
      } else {
        posts.set(post.id, {
          id: post.id, slug: post.slug, title: title || row.title,
          images: images.map((image) => ({ ...image, alt: image.alt || title || row.title })),
          projectIds: [row.id],
        });
      }
      postIds.push(post.id);
    }
    if (postIds.length) projects.push({ id: row.id, slug: row.slug, title: row.title, postIds });
  }
  return { posts: [...posts.values()], projects };
}
