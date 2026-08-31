import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import {
  generateImageAlt,
  generatePostIdentity,
  generatePostSeo,
} from "@/lib/ai-seo";
import { processAiSeoReviews } from "@/lib/ai-seo-reviews";
import { SEO_REVIEW_PRIORITY } from "@/lib/seo-review";
import { toSlug } from "@/lib/slug";
import { isSystemPostTitle } from "@/lib/post-text";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { invalidatePublicFeedCache } from "@/lib/cache-tags";
import { touchPostAfterImageChange } from "@/lib/post-image-change";
import { notifyIndexNowPaths } from "@/lib/indexnow";
import { getAiSeoWorkerStatus, type AiSeoWorkerStatus } from "@/lib/ai-seo-worker";

const JOB_TYPE = {
  POST_SEO: "POST_SEO",
  IMAGE_ALT: "IMAGE_ALT",
} as const;

const JOB_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  DONE: "DONE",
  REVIEW: "REVIEW",
  FAILED: "FAILED",
} as const;

type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

type GeneratedPostSeo = {
  title: string;
  description: string;
  confidence: number;
};

type QueueOptions = {
  metadata?: boolean;
  /** Ручная кнопка может обновить уже сгенерированные alt; ручные никогда не трогаем. */
  forceImages?: boolean;
  /**
   * Первичный проход по старым публикациям: берём только незаполненные поля.
   * Уже созданный AI-текст не расходует лимит повторно.
   */
  onlyMissing?: boolean;
};

type QueueResult = { jobIds: string[] };

export type AiSeoProcessSummary = {
  claimed: number;
  done: number;
  review: number;
  retrying: number;
  failed: number;
};

export type AiSeoBackfillStatus = {
  postsNeedingSeo: number;
  imagesNeedingAlt: number;
  pending: number;
  running: number;
  review: number;
  failed: number;
  worker: AiSeoWorkerStatus;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function retryDate(attempt: number): Date {
  const minutes = Math.min(60, 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + minutes * 60_000);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка AI";
  return message.replace(/[\r\n]+/g, " ").slice(0, 280);
}

function isAutomaticSlug(slug: string): boolean {
  return (
    slug.startsWith("draft-") ||
    slug.startsWith("post-") ||
    /^bez-nazvaniya(?:-\d+)?$/u.test(slug) ||
    slug === "novaya-publikaciya" ||
    slug === "chernovik"
  );
}

async function uniquePostSlug(
  tx: Pick<typeof prisma, "post">,
  rawTitle: string,
  postId: string,
): Promise<string> {
  const base = toSlug(rawTitle) || `post-${postId.slice(0, 6)}`;
  let slug = base;
  let suffix = 2;
  while (
    await tx.post.findFirst({
      where: { slug, NOT: { id: postId } },
      select: { id: true },
    })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function revalidateAiUpdatedPost(slugs: Array<string | null | undefined>) {
  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidatePath(`/p/${slug}`);
  }
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/sitemap.xml");
  invalidatePublicFeedCache();
}

async function putJob(postId: string, type: JobType, subjectKey: string) {
  return prisma.aiSeoJob.upsert({
    where: { postId_type_subjectKey: { postId, type, subjectKey } },
    create: {
      postId,
      type,
      subjectKey,
      status: JOB_STATUS.PENDING,
      revision: 1,
      runAfter: new Date(),
    },
    update: {
      status: JOB_STATUS.PENDING,
      revision: { increment: 1 },
      inputHash: "",
      outputJson: "{}",
      runAfter: new Date(),
      lockedAt: null,
      completedAt: null,
      lastError: "",
    },
    select: { id: true },
  });
}

/**
 * Создаёт durable-задачи только для опубликованного поста. Значения автора
 * исключаются ещё здесь, а затем проверяются повторно непосредственно перед записью.
 */
export async function enqueuePublishedPostAiSeo(
  postId: string,
  options: QueueOptions = {},
): Promise<QueueResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
      metaTitleSource: true,
      metaDescriptionSource: true,
      images: { select: { id: true, alt: true, altSource: true } },
    },
  });
  if (!post || post.status !== POST_STATUS.PUBLISHED) return { jobIds: [] };

  const jobIds: string[] = [];
  if (
    options.metadata !== false &&
    (options.onlyMissing
      ? post.metaTitleSource === "AUTO" || post.metaDescriptionSource === "AUTO"
      : post.metaTitleSource !== "MANUAL" || post.metaDescriptionSource !== "MANUAL")
  ) {
    jobIds.push((await putJob(postId, JOB_TYPE.POST_SEO, "POST")).id);
  }

  const images = post.images.filter(
    (image) =>
      image.altSource !== "MANUAL" &&
      (Boolean(options.forceImages) ||
        (options.onlyMissing
          ? image.altSource === "AUTO" && !image.alt.trim()
          : !image.alt.trim())),
  );
  for (const image of images) {
    jobIds.push((await putJob(postId, JOB_TYPE.IMAGE_ALT, image.id)).id);
  }
  return { jobIds };
}

/**
 * Одноразово ставит в очередь старые публикации. Значения автора и уже готовый
 * результат AI не затрагиваются: нужны только пустые SEO-поля и alt.
 */
export async function enqueuePublishedPostsAiSeoBackfill(): Promise<{
  posts: number;
  jobs: number;
}> {
  const posts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.PUBLISHED,
      OR: [
        { metaTitleSource: "AUTO" },
        { metaDescriptionSource: "AUTO" },
        {
          images: {
            some: {
              altSource: "AUTO",
              alt: "",
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  let jobs = 0;
  const batchSize = 8;
  for (let index = 0; index < posts.length; index += batchSize) {
    const queued = await Promise.all(
      posts
        .slice(index, index + batchSize)
        .map((post) => enqueuePublishedPostAiSeo(post.id, { onlyMissing: true })),
    );
    jobs += queued.reduce((total, row) => total + row.jobIds.length, 0);
  }
  return { posts: posts.length, jobs };
}

/** Статус показываем автору коротко: сколько ещё реально ждёт подготовки. */
export async function getAiSeoBackfillStatus(): Promise<AiSeoBackfillStatus> {
  const [postsNeedingSeo, imagesNeedingAlt, groupedJobs] = await Promise.all([
    prisma.post.count({
      where: {
        status: POST_STATUS.PUBLISHED,
        OR: [{ metaTitleSource: "AUTO" }, { metaDescriptionSource: "AUTO" }],
      },
    }),
    prisma.postImage.count({
      where: {
        post: { status: POST_STATUS.PUBLISHED },
        altSource: "AUTO",
        alt: "",
      },
    }),
    prisma.aiSeoJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const countByStatus = new Map(
    groupedJobs.map((row) => [row.status, row._count._all]),
  );
  return {
    postsNeedingSeo,
    imagesNeedingAlt,
    pending: countByStatus.get(JOB_STATUS.PENDING) ?? 0,
    running: countByStatus.get(JOB_STATUS.RUNNING) ?? 0,
    review: countByStatus.get(JOB_STATUS.REVIEW) ?? 0,
    failed: countByStatus.get(JOB_STATUS.FAILED) ?? 0,
    worker: getAiSeoWorkerStatus(),
  };
}

/** Исполнитель одного прохода: вызывается из after, локального worker или резервного cron. */
export async function processAiSeoJobs(options?: {
  limit?: number;
  jobIds?: string[];
}): Promise<AiSeoProcessSummary> {
  const result: AiSeoProcessSummary = {
    claimed: 0,
    done: 0,
    review: 0,
    retrying: 0,
    failed: 0,
  };
  const limit = Math.max(1, Math.min(options?.limit ?? 4, 12));
  const now = new Date();
  const expiredLock = new Date(Date.now() - 10 * 60_000);

  const mergeReviews = (reviews: Awaited<ReturnType<typeof processAiSeoReviews>>) => {
    result.claimed += reviews.claimed;
    result.done += reviews.ready;
    result.retrying += reviews.retrying;
    result.failed += reviews.failed;
  };

  // При явном запуске очереди автором срочные предложения SEO важнее
  // автоматического backfill alt. Иначе автор нажимает «Предложить», но может
  // долго ничего не увидеть за крупной очередью изображений.
  const isGeneralRun = !options?.jobIds?.length;
  if (isGeneralRun) {
    mergeReviews(
      await processAiSeoReviews({
        limit,
        priority: SEO_REVIEW_PRIORITY.CRITICAL,
      }),
    );
  }

  const availableSlots = limit - result.claimed;
  if (!availableSlots) return result;

  // Если инстанс завершился во время запроса к модели, задача не теряется.
  await prisma.aiSeoJob.updateMany({
    where: { status: JOB_STATUS.RUNNING, lockedAt: { lt: expiredLock } },
    data: { status: JOB_STATUS.PENDING, lockedAt: null, runAfter: now },
  });

  const candidates = await prisma.aiSeoJob.findMany({
    where: {
      ...(options?.jobIds?.length ? { id: { in: options.jobIds } } : {}),
      status: { in: [JOB_STATUS.PENDING] },
      runAfter: { lte: now },
    },
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
    take: availableSlots,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const claim = await prisma.aiSeoJob.updateMany({
      where: {
        id: candidate.id,
        status: JOB_STATUS.PENDING,
        runAfter: { lte: new Date() },
      },
      data: {
        status: JOB_STATUS.RUNNING,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    result.claimed += 1;

    const job = await prisma.aiSeoJob.findUnique({ where: { id: candidate.id } });
    if (!job) continue;
    try {
      const status = await executeJob(job);
      if (status === JOB_STATUS.DONE) result.done += 1;
      else if (status === JOB_STATUS.REVIEW) result.review += 1;
    } catch (error) {
      const permanent = job.attempts >= 3 || safeError(error).includes("не настроен");
      const nextStatus = permanent ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;
      const updated = await prisma.aiSeoJob.updateMany({
        where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
        data: {
          status: nextStatus,
          lockedAt: null,
          lastError: safeError(error),
          runAfter: permanent ? new Date() : retryDate(job.attempts),
        },
      });
      if (updated.count) {
        if (permanent) {
          // Публикация без подписи не должна застрять из-за недоступной модели.
          // После трёх сетевых попыток даём ей уникальный нейтральный fallback.
          if (job.type === JOB_TYPE.POST_SEO) {
            await applyAutomaticIdentityFallback(job, { jobAlreadySettled: true });
          }
          result.failed += 1;
        } else result.retrying += 1;
      }
    }
  }

  // Обычная автогенерация для новых постов обрабатывается адресно через
  // `jobIds`. Предложения для старых ручных полей забирает только общий
  // фоновый проход (after/cron), чтобы импорт не тратил лимит на чужие задачи.
  if (isGeneralRun && result.claimed < limit) {
    mergeReviews(
      await processAiSeoReviews({
        limit: limit - result.claimed,
        priority: SEO_REVIEW_PRIORITY.IMPROVE,
      }),
    );
  }
  return result;
}

type Job = Awaited<ReturnType<typeof prisma.aiSeoJob.findUnique>>;

async function executeJob(job: NonNullable<Job>): Promise<"DONE" | "REVIEW"> {
  if (job.type === JOB_TYPE.POST_SEO) return executePostSeoJob(job);
  if (job.type === JOB_TYPE.IMAGE_ALT) return executeImageAltJob(job);
  return markReview(job, "Неизвестный тип задачи");
}

async function executePostSeoJob(job: NonNullable<Job>): Promise<"DONE" | "REVIEW"> {
  const post = await prisma.post.findUnique({
    where: { id: job.postId },
    select: {
      id: true,
      status: true,
      title: true,
      body: true,
      metaTitleSource: true,
      metaDescriptionSource: true,
      category: { select: { name: true } },
      projects: { select: { project: { select: { title: true } } } },
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { variantsJson: true },
      },
    },
  });
  if (!post || post.status !== POST_STATUS.PUBLISHED) {
    return markDone(job, { skipped: "post-is-not-published" });
  }
  if (post.metaTitleSource === "MANUAL" && post.metaDescriptionSource === "MANUAL") {
    return markDone(job, { skipped: "manual-metadata" });
  }

  const input = {
    title: post.title,
    body: post.body,
    categoryName: post.category?.name ?? null,
    projectTitles: post.projects.map((row) => row.project.title),
  };
  const needsIdentity = isSystemPostTitle(post.title);
  const inputHash = hash({
    ...input,
    variantsJson: post.images[0]?.variantsJson ?? null,
    needsIdentity,
  });
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { authorName: true, displayName: true },
  });
  const authorName =
    settings?.authorName.trim() || settings?.displayName.trim() || "Алиса Гольнева";
  const generated = needsIdentity
    ? await generatePostIdentity({
        authorName,
        ...input,
        variantsJson: post.images[0]?.variantsJson ?? null,
      })
    : await generatePostSeo({ authorName, ...input });
  if (!generated) {
    return needsIdentity
      ? applyAutomaticIdentityFallback(job, { inputHash })
      : markReview(job, "AI вернул непригодный SEO-текст", inputHash);
  }

  return applyPostSeo(job, generated, inputHash, { applyIdentity: needsIdentity });
}

async function executeImageAltJob(job: NonNullable<Job>): Promise<"DONE" | "REVIEW"> {
  const post = await prisma.post.findUnique({
    where: { id: job.postId },
    select: {
      id: true,
      status: true,
      title: true,
      body: true,
      category: { select: { name: true } },
      projects: { select: { project: { select: { title: true } } } },
      images: {
        where: { id: job.subjectKey },
        select: { id: true, caption: true, altSource: true, variantsJson: true },
      },
    },
  });
  const image = post?.images[0];
  if (!post || !image || post.status !== POST_STATUS.PUBLISHED) {
    return markDone(job, { skipped: "image-or-post-is-not-published" });
  }
  if (image.altSource === "MANUAL") return markDone(job, { skipped: "manual-alt" });

  const input = {
    title: post.title,
    body: post.body,
    categoryName: post.category?.name ?? null,
    projectTitles: post.projects.map((row) => row.project.title),
    caption: image.caption,
    variantsJson: image.variantsJson,
  };
  const inputHash = hash(input);
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { authorName: true, displayName: true },
  });
  const generated = await generateImageAlt({
    authorName: settings?.authorName.trim() || settings?.displayName.trim() || "Алиса Гольнева",
    ...input,
  });
  if (!generated) return markReview(job, "Не удалось получить изображение или alt от AI", inputHash);

  return applyImageAlt(job, generated, inputHash);
}

async function markDone(
  job: NonNullable<Job>,
  output: Record<string, unknown>,
): Promise<"DONE"> {
  await prisma.aiSeoJob.updateMany({
    where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
    data: {
      status: JOB_STATUS.DONE,
      inputHash: hash(output),
      outputJson: JSON.stringify(output),
      lockedAt: null,
      completedAt: new Date(),
      lastError: "",
    },
  });
  return JOB_STATUS.DONE;
}

async function markReview(
  job: NonNullable<Job>,
  reason: string,
  inputHash = "",
): Promise<"REVIEW"> {
  await prisma.aiSeoJob.updateMany({
    where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
    data: {
      status: JOB_STATUS.REVIEW,
      inputHash,
      lockedAt: null,
      completedAt: new Date(),
      lastError: reason,
    },
  });
  return JOB_STATUS.REVIEW;
}

async function applyPostSeo(
  job: NonNullable<Job>,
  generated: GeneratedPostSeo,
  inputHash: string,
  options: { applyIdentity?: boolean } = {},
): Promise<"DONE"> {
  let changedSlugs: string[] = [];
  await prisma.$transaction(async (tx) => {
    // При постановке новой версии в очередь revision увеличивается. Поэтому старый ответ
    // не сможет попасть в базу даже если модель ответила позже.
    const claimed = await tx.aiSeoJob.updateMany({
      where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
      data: {
        status: JOB_STATUS.DONE,
        inputHash,
        outputJson: JSON.stringify(generated),
        lockedAt: null,
        completedAt: new Date(),
        lastError: "",
      },
    });
    if (!claimed.count) return;
    const current = await tx.post.findUnique({
      where: { id: job.postId },
      select: {
        id: true,
        status: true,
        title: true,
        slug: true,
        oldSlugs: true,
        metaTitleSource: true,
        metaDescriptionSource: true,
      },
    });
    if (!current || current.status !== POST_STATUS.PUBLISHED) return;
    const data: {
      title?: string;
      slug?: string;
      oldSlugs?: string[];
      metaTitle?: string;
      metaTitleSource?: string;
      metaDescription?: string;
      metaDescriptionSource?: string;
    } = {};
    if (options.applyIdentity && isSystemPostTitle(current.title)) {
      data.title = generated.title;
      if (isAutomaticSlug(current.slug)) {
        const nextSlug = await uniquePostSlug(tx, generated.title, current.id);
        data.slug = nextSlug;
        // У опубликованного draft-URL мог уже появиться внешний переход:
        // сохраняем его для постоянного перенаправления после AI-подготовки.
        data.oldSlugs = [...new Set([...current.oldSlugs, current.slug])];
      }
    }
    if (current.metaTitleSource !== "MANUAL") {
      data.metaTitle = generated.title;
      data.metaTitleSource = "AI";
    }
    if (current.metaDescriptionSource !== "MANUAL") {
      data.metaDescription = generated.description;
      data.metaDescriptionSource = "AI";
    }
    if (Object.keys(data).length) {
      await tx.post.update({ where: { id: job.postId }, data });
      changedSlugs = [current.slug, data.slug ?? current.slug];
    }
  });
  if (changedSlugs.length) {
    revalidateAiUpdatedPost(changedSlugs);
    await notifyIndexNowPaths([
      ...changedSlugs.map((slug) => `/p/${slug}`),
      "/",
      "/archive",
    ]);
  }
  return JOB_STATUS.DONE;
}

/**
 * Никаких вопросов автору при недоступном AI: только в этом редком случае
 * создаём уникальную нейтральную пару «Без названия — N» / `bez-nazvaniya-N`.
 */
async function applyAutomaticIdentityFallback(
  job: NonNullable<Job>,
  options: { inputHash?: string; jobAlreadySettled?: boolean } = {},
): Promise<"DONE"> {
  let changedSlugs: string[] = [];
  await prisma.$transaction(async (tx) => {
    if (!options.jobAlreadySettled) {
      const claimed = await tx.aiSeoJob.updateMany({
        where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
        data: {
          status: JOB_STATUS.DONE,
          inputHash: options.inputHash ?? hash({ fallback: job.id }),
          outputJson: JSON.stringify({ fallback: "untitled" }),
          lockedAt: null,
          completedAt: new Date(),
          lastError: "",
        },
      });
      if (!claimed.count) return;
    }

    const current = await tx.post.findUnique({
      where: { id: job.postId },
      select: {
        id: true,
        status: true,
        title: true,
        slug: true,
        oldSlugs: true,
        body: true,
        metaTitleSource: true,
        metaDescriptionSource: true,
      },
    });
    if (
      !current ||
      current.status !== POST_STATUS.PUBLISHED ||
      !isSystemPostTitle(current.title)
    ) {
      return;
    }

    let suffix = 1;
    let slug = "bez-nazvaniya-1";
    while (
      await tx.post.findFirst({
        where: { slug, NOT: { id: current.id } },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `bez-nazvaniya-${suffix}`;
    }
    const title = `Без названия — ${suffix}`;
    const data: {
      title: string;
      slug: string;
      oldSlugs: string[];
      metaTitle?: string;
      metaTitleSource?: string;
      metaDescription?: string;
      metaDescriptionSource?: string;
    } = {
      title,
      slug,
      oldSlugs: [...new Set([...current.oldSlugs, current.slug])],
    };
    if (current.metaTitleSource !== "MANUAL") {
      data.metaTitle = title;
      data.metaTitleSource = "AUTO";
    }
    if (current.metaDescriptionSource !== "MANUAL") {
      data.metaDescription =
        excerptForMetaDescription(current.body) || "Авторская работа из портфолио.";
      data.metaDescriptionSource = "AUTO";
    }
    await tx.post.update({ where: { id: current.id }, data });
    changedSlugs = [current.slug, slug];
  });
  if (changedSlugs.length) {
    revalidateAiUpdatedPost(changedSlugs);
    await notifyIndexNowPaths([
      ...changedSlugs.map((slug) => `/p/${slug}`),
      "/",
      "/archive",
    ]);
  }
  return JOB_STATUS.DONE;
}

async function applyImageAlt(
  job: NonNullable<Job>,
  generated: { alt: string; confidence: number },
  inputHash: string,
): Promise<"DONE"> {
  let changedSlug: string | null = null;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.aiSeoJob.updateMany({
      where: { id: job.id, revision: job.revision, status: JOB_STATUS.RUNNING },
      data: {
        status: JOB_STATUS.DONE,
        inputHash,
        outputJson: JSON.stringify(generated),
        lockedAt: null,
        completedAt: new Date(),
        lastError: "",
      },
    });
    if (!claimed.count) return;
    const current = await tx.postImage.findUnique({
      where: { id: job.subjectKey },
      select: {
        id: true,
        postId: true,
        altSource: true,
        post: { select: { slug: true, status: true } },
      },
    });
    if (!current || current.postId !== job.postId || current.altSource === "MANUAL") return;
    await tx.postImage.update({
      where: { id: current.id },
      data: { alt: generated.alt, altSource: "AI" },
    });
    await touchPostAfterImageChange(tx, current.postId);
    if (current.post.status === POST_STATUS.PUBLISHED) {
      changedSlug = current.post.slug;
    }
  });
  if (changedSlug) {
    await notifyIndexNowPaths([`/p/${changedSlug}`, "/"]);
  }
  return JOB_STATUS.DONE;
}

export const AI_SEO_JOB_STATUS = JOB_STATUS;
