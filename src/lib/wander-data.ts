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
  const rows = await prisma.post.findMany({
    where: { status: "PUBLISHED", images: { some: {} } },
    orderBy: { id: "asc" },
    select: {
      id: true, slug: true, title: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, variantsJson: true, alt: true, width: true, height: true },
      },
      projects: {
        where: { project: { status: "PUBLISHED" } },
        orderBy: { projectId: "asc" },
        select: { project: { select: { id: true, slug: true, title: true } } },
      },
    },
  });
  const projects = new Map<string, WanderCatalogue["projects"][number]>();
  const posts: WanderPost[] = [];
  for (const post of rows) {
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
    const firstProject = post.projects[0]?.project;
    const title = plainPostPreview(isSystemPostTitle(post.title)
      ? images[0]!.alt || firstProject?.title || "Без названия"
      : post.title).slice(0, 160);
    const projectIds = post.projects.map(({ project }) => project.id);
    posts.push({
      id: post.id, slug: post.slug, title: title || firstProject?.title || "Без названия",
      images: images.map((image) => ({ ...image, alt: image.alt || title || firstProject?.title || "Работа" })),
      projectIds,
    });
    for (const { project } of post.projects) {
      const existing = projects.get(project.id);
      if (existing) existing.postIds.push(post.id);
      else projects.set(project.id, { ...project, postIds: [post.id] });
    }
  }
  return { posts, projects: [...projects.values()] };
}
