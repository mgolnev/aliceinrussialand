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
import { parseVariants } from "@/lib/posts-query";
import type { FeedPost } from "@/types/feed";

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

export type PublishedProjectSummary = Omit<PublishedProject, "posts">;

export type PublishedPostProject = PublishedProjectSummary & {
  posts: Array<{ id: string; slug: string }>;
};

export type PublishedProjectPostsPage = {
  items: PublishedProjectPost[];
  total: number;
  page: number;
  pageSize: number;
};

export const PROJECT_PAGE_SIZE = 8;

/** Единый JSON-вид карточки для SSR подборки и её клиентского продолжения. */
export function projectPostToFeedPost(post: PublishedProjectPost): FeedPost {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    body: post.body,
    displayMode: post.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: post.publishedAt?.toISOString() ?? null,
    pinned: post.pinned,
    showInAll: post.showInAll,
    categoryId: post.categoryId,
    category: post.category,
    // Страница уже находится внутри этой подборки — повторять её тег под карточкой не нужно.
    projects: [],
    images: post.images.map((image) => ({
      id: image.id,
      caption: image.caption,
      alt: image.alt,
      variants: parseVariants(image.variantsJson),
      width: image.width,
      height: image.height,
    })),
  };
}

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

const projectSummarySelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  metaTitle: true,
  metaDescription: true,
  orderMode: true,
  updatedAt: true,
  posts: {
    where: { post: { status: POST_STATUS.PUBLISHED } },
    take: 2,
    select: { id: true },
  },
} as const;

/** Публичный цикл: метаданные без тяжёлых body/images, минимум две публикации. */
export async function getPublishedProjectBySlug(
  slug: string,
): Promise<PublishedProjectSummary | null> {
  const row = await prisma.project.findFirst({
    where: { slug, status: PROJECT_STATUS.PUBLISHED },
    select: projectSummarySelect,
  });
  if (!row || row.posts.length < 2) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    orderMode: projectOrderMode(row.orderMode),
    updatedAt: row.updatedAt,
  };
}

/**
 * Циклы и ссылки для рекомендаций под одним постом. Не читаем body и изображения
 * всех связанных записей: они будут выбраны каруселью только для видимых карточек.
 */
export async function getPublishedPostProjects(
  postId: string,
): Promise<PublishedPostProject[]> {
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
            posts: {
              where: { post: { status: POST_STATUS.PUBLISHED } },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              take: 17,
              select: {
                post: { select: { id: true, slug: true, publishedAt: true } },
              },
            },
          },
      },
    },
  });

  return rows
    .map(({ project }) => {
      const orderMode = projectOrderMode(project.orderMode);
      const posts = project.posts.map(({ post }) => post);
      if (orderMode === PROJECT_ORDER_MODE.NEWEST_FIRST) {
        posts.sort(comparePostsNewestFirst);
      }
      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        description: project.description,
        metaTitle: project.metaTitle,
        metaDescription: project.metaDescription,
        orderMode,
        updatedAt: project.updatedAt,
        posts: posts.map(({ id, slug }) => ({ id, slug })),
      };
    })
    .filter((project) => project.posts.length >= 2);
}

export const getPublishedProjectBySlugCached = cache(getPublishedProjectBySlug);
export const getPublishedPostProjectsCached = cache(getPublishedPostProjects);

/** Ограниченная страница карточек проекта; порядок сохраняет режим проекта. */
export async function getPublishedProjectPostsPage(
  projectId: string,
  orderMode: ProjectOrderMode,
  page: number,
  pageSize: number = PROJECT_PAGE_SIZE,
): Promise<PublishedProjectPostsPage> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Math.max(1, Math.min(Math.floor(pageSize), 24));
  const skip = (normalizedPage - 1) * normalizedPageSize;
  const where = {
    projectId,
    post: { status: POST_STATUS.PUBLISHED },
  } satisfies Prisma.PostProjectWhereInput;
  const orderBy: Prisma.PostProjectOrderByWithRelationInput[] =
    orderMode === PROJECT_ORDER_MODE.MANUAL
      ? [{ sortOrder: "asc" }, { createdAt: "asc" }]
      : [{ post: { publishedAt: "desc" } }, { postId: "asc" }];

  const [total, rows] = await Promise.all([
    prisma.postProject.count({ where }),
    prisma.postProject.findMany({
      where,
      orderBy,
      skip,
      take: normalizedPageSize,
      select: publishedPostsSelect.select,
    }),
  ]);

  return {
    items: rows.map(({ post }) => post),
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

export const getPublishedProjectPostsPageCached = cache(
  getPublishedProjectPostsPage,
);

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
