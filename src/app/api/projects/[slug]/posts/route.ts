import { NextResponse } from "next/server";
import {
  getPublishedProjectBySlugCached,
  getPublishedProjectPostsPageCached,
  projectPostToFeedPost,
} from "@/lib/projects";
import { parsePageNumber } from "@/lib/seo-content";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ slug: string }>;
};

/** Следующая порция непрерывной ленты подборки. */
export async function GET(request: Request, { params }: Context) {
  const [{ slug }, page] = await Promise.all([
    params,
    Promise.resolve(parsePageNumber(new URL(request.url).searchParams.get("page") ?? undefined)),
  ]);
  const project = await getPublishedProjectBySlugCached(slug);
  if (!project) {
    return NextResponse.json(
      { error: "project not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const postsPage = await getPublishedProjectPostsPageCached(
    project.id,
    project.orderMode,
    page,
  );
  if (page > 1 && !postsPage.items.length) {
    return NextResponse.json(
      { error: "page not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const nextPage =
    postsPage.page * postsPage.pageSize < postsPage.total
      ? postsPage.page + 1
      : null;
  return NextResponse.json(
    {
      items: postsPage.items.map(projectPostToFeedPost),
      nextPage,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    },
  );
}
