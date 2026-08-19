import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import {
  comparePostsNewestFirst,
  projectOrderMode,
  PROJECT_ORDER_MODE,
  type ProjectOrderMode,
} from "@/lib/project-order";

export const PROJECT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export { PROJECT_ORDER_MODE, projectOrderMode };
export type { ProjectOrderMode };

export type PublishedProjectPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  updatedAt: Date;
  publishedAt: Date | null;
  displayMode: string;
  pinned: boolean;
  showInAll: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  images: Array<{
    id: string;
    caption: string;
    alt: string;
    variantsJson: string;
    width: number | null;
    height: number | null;
  }>;
};

export type PublishedProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  orderMode: ProjectOrderMode;
  updatedAt: Date;
  posts: PublishedProjectPost[];
};

export type PublishedProjectLink = Pick<PublishedProject, "id" | "slug" | "title">;

const publishedPostsSelect = {
  where: { post: { status: POST_STATUS.PUBLISHED } },
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  select: {
    sortOrder: true,
    createdAt: true,
    post: {
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        updatedAt: true,
        publishedAt: true,
        displayMode: true,
        pinned: true,
        showInAll: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            caption: true,
            alt: true,
            variantsJson: true,
            width: true,
            height: true,
          },
        },
      },
    },
  },
} satisfies Prisma.Project$postsArgs;

function projectWithPublishedPosts(row: {
  id: string;
  slug: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  orderMode: string;
  updatedAt: Date;
  posts: Array<{
    sortOrder: number;
    createdAt: Date;
    post: PublishedProjectPost;
  }>;
}): PublishedProject {
  const orderMode = projectOrderMode(row.orderMode);
  const orderedRelations = [...row.posts].sort((a, b) => {
    if (orderMode === PROJECT_ORDER_MODE.MANUAL) {
      return a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime();
    }
    return (
      comparePostsNewestFirst(a.post, b.post) ||
      a.sortOrder - b.sortOrder ||
      a.createdAt.getTime() - b.createdAt.getTime()
    );
  });

  return {
    ...row,
    orderMode,
    posts: orderedRelations.map((relation) => relation.post),
  };
}

/** Публичный цикл: только опубликованный цикл, в котором есть минимум две публикации. */
export async function getPublishedProjectBySlug(
  slug: string,
): Promise<PublishedProject | null> {
  const row = await prisma.project.findFirst({
    where: { slug, status: PROJECT_STATUS.PUBLISHED },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      orderMode: true,
      updatedAt: true,
      posts: publishedPostsSelect,
    },
  });
  if (!row || row.posts.length < 2) return null;
  return projectWithPublishedPosts(row);
}

/** Циклы, которые можно показать внизу опубликованного поста. */
export async function getPublishedPostProjects(
  postId: string,
): Promise<PublishedProject[]> {
  const rows = await prisma.postProject.findMany({
    where: {
      postId,
      project: { status: PROJECT_STATUS.PUBLISHED },
    },
    orderBy: [{ project: { updatedAt: "desc" } }],
    select: {
      project: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          metaTitle: true,
          metaDescription: true,
          orderMode: true,
          updatedAt: true,
          posts: publishedPostsSelect,
        },
      },
    },
  });

  return rows
    .map((row) => projectWithPublishedPosts(row.project))
    .filter((project) => project.posts.length >= 2);
}

export const getPublishedProjectBySlugCached = cache(getPublishedProjectBySlug);
export const getPublishedPostProjectsCached = cache(getPublishedPostProjects);

/** Короткий список циклов для единственного статичного блока навигации в подвале. */
export async function listPublishedProjectLinks(): Promise<PublishedProjectLink[]> {
  const rows = await prisma.project.findMany({
    where: {
      status: PROJECT_STATUS.PUBLISHED,
      posts: { some: { post: { status: POST_STATUS.PUBLISHED } } },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      posts: {
        where: { post: { status: POST_STATUS.PUBLISHED } },
        select: { id: true },
      },
    },
  });

  return rows.filter((project) => project.posts.length >= 2).map(({ id, slug, title }) => ({
    id,
    slug,
    title,
  }));
}
