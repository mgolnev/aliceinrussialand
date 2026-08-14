import type { FeedPost } from "@/types/feed";

/** Ответ PATCH /api/admin/posts/[id] → форма для ленты. */
export function feedPostFromAdminPatchJson(json: unknown): FeedPost | null {
  if (!json || typeof json !== "object") return null;
  const p = json as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.slug !== "string") return null;

  const catRaw = p.category;
  let category: FeedPost["category"] = null;
  if (catRaw && typeof catRaw === "object") {
    const c = catRaw as Record<string, unknown>;
    if (typeof c.id === "string" && typeof c.name === "string" && typeof c.slug === "string") {
      category = { id: c.id, name: c.name, slug: c.slug };
    }
  }

  const imagesRaw = p.images;
  const images: FeedPost["images"] = [];
  if (Array.isArray(imagesRaw)) {
    for (const im of imagesRaw) {
      if (!im || typeof im !== "object") continue;
      const row = im as Record<string, unknown>;
      if (typeof row.id !== "string") continue;
      const variants =
        row.variants && typeof row.variants === "object" && row.variants !== null
          ? (row.variants as Record<string, string>)
          : {};
      images.push({
        id: row.id,
        caption: typeof row.caption === "string" ? row.caption : "",
        alt: typeof row.alt === "string" ? row.alt : "",
        variants,
        width: typeof row.width === "number" ? row.width : null,
        height: typeof row.height === "number" ? row.height : null,
      });
    }
  }

  const projects: FeedPost["projects"] = [];
  if (Array.isArray(p.projects)) {
    for (const relation of p.projects) {
      if (!relation || typeof relation !== "object") continue;
      const project = (relation as Record<string, unknown>).project;
      if (!project || typeof project !== "object") continue;
      const row = project as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.slug !== "string" ||
        typeof row.title !== "string" ||
        row.status !== "PUBLISHED"
      ) {
        continue;
      }
      projects.push({ id: row.id, slug: row.slug, title: row.title });
    }
  }

  return {
    id: p.id,
    slug: p.slug,
    title: typeof p.title === "string" ? p.title : "",
    body: typeof p.body === "string" ? p.body : "",
    displayMode: p.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: typeof p.publishedAt === "string" ? p.publishedAt : null,
    pinned: Boolean(p.pinned),
    showInAll: p.showInAll !== false,
    categoryId: typeof p.categoryId === "string" ? p.categoryId : null,
    category,
    projects,
    images,
  };
}
