import type { AdminPostListRow } from "@/components/admin/admin-post-list-types";

export type AdminPostsListSortMode =
  | "feed_order"
  | "updated_desc"
  | "published_desc"
  | "created_desc"
  | "title_asc";

export const ADMIN_POSTS_SORT_STORAGE_KEY = "admin-posts-sort-v1";

export function isAdminPostsListSortMode(
  s: string | null,
): s is AdminPostsListSortMode {
  return (
    s === "feed_order" ||
    s === "updated_desc" ||
    s === "published_desc" ||
    s === "created_desc" ||
    s === "title_asc"
  );
}

function byIsoDesc(aIso: string, bIso: string): number {
  return new Date(bIso).getTime() - new Date(aIso).getTime();
}

export function sortAdminPostRows(
  rows: AdminPostListRow[],
  mode: AdminPostsListSortMode,
): AdminPostListRow[] {
  const out = [...rows];

  const tieId = (a: AdminPostListRow, b: AdminPostListRow, primary: number) =>
    primary !== 0 ? primary : b.id.localeCompare(a.id);

  switch (mode) {
    case "updated_desc":
      out.sort((a, b) => tieId(a, b, byIsoDesc(a.updatedAt, b.updatedAt)));
      break;
    case "created_desc":
      out.sort((a, b) => tieId(a, b, byIsoDesc(a.createdAt, b.createdAt)));
      break;
    case "published_desc":
      out.sort((a, b) => {
        const ap = a.publishedAt;
        const bp = b.publishedAt;
        let primary: number;
        if (ap && bp) primary = byIsoDesc(ap, bp);
        else if (ap && !bp) primary = -1;
        else if (!ap && bp) primary = 1;
        else primary = byIsoDesc(a.updatedAt, b.updatedAt);
        return tieId(a, b, primary);
      });
      break;
    case "title_asc":
      out.sort((a, b) => {
        const primary = a.title.localeCompare(b.title, "ru", {
          sensitivity: "base",
        });
        return primary !== 0 ? primary : b.id.localeCompare(a.id);
      });
      break;
    case "feed_order":
      out.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const ap = a.publishedAt;
        const bp = b.publishedAt;
        let primary: number;
        if (ap && bp) primary = byIsoDesc(ap, bp);
        else if (ap && !bp) primary = -1;
        else if (!ap && bp) primary = 1;
        else primary = b.id.localeCompare(a.id);
        return tieId(a, b, primary);
      });
      break;
    default:
      break;
  }
  return out;
}
