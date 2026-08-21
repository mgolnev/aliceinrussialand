import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { generateImageAlt, generatePostSeo } from "@/lib/ai-seo";

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

type QueueOptions = {
  metadata?: boolean;
  /** Ручная кнопка может обновить уже сгенерированные alt; ручные никогда не трогаем. */
  forceImages?: boolean;
};

type QueueResult = { jobIds: string[] };

export type AiSeoProcessSummary = {
  claimed: number;
  done: number;
  review: number;
  retrying: number;
  failed: number;
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
    (post.metaTitleSource !== "MANUAL" || post.metaDescriptionSource !== "MANUAL")
  ) {
    jobIds.push((await putJob(postId, JOB_TYPE.POST_SEO, "POST")).id);
  }

  const images = post.images.filter(
    (image) =>
      image.altSource !== "MANUAL" &&
      (Boolean(options.forceImages) || !image.alt.trim()),
  );
  for (const image of images) {
    jobIds.push((await putJob(postId, JOB_TYPE.IMAGE_ALT, image.id)).id);
  }
  return { jobIds };
}

/** Фоновый исполнитель: `after` вызывает его сразу, а внешний cron подхватывает невыполненные задачи. */
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
    take: limit,
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
        if (permanent) result.failed += 1;
        else result.retrying += 1;
      }
    }
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
  const inputHash = hash(input);
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { authorName: true, displayName: true },
  });
  const generated = await generatePostSeo({
    authorName: settings?.authorName.trim() || settings?.displayName.trim() || "Алиса Гольнева",
    ...input,
  });
  if (!generated) return markReview(job, "AI вернул непригодный SEO-текст", inputHash);

  return applyPostSeo(job, generated, inputHash);
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
  generated: { title: string; description: string; confidence: number },
  inputHash: string,
): Promise<"DONE"> {
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
      select: { status: true, metaTitleSource: true, metaDescriptionSource: true },
    });
    if (!current || current.status !== POST_STATUS.PUBLISHED) return;
    const data: { metaTitle?: string; metaTitleSource?: string; metaDescription?: string; metaDescriptionSource?: string } = {};
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
    }
  });
  return JOB_STATUS.DONE;
}

async function applyImageAlt(
  job: NonNullable<Job>,
  generated: { alt: string; confidence: number },
  inputHash: string,
): Promise<"DONE"> {
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
      select: { id: true, postId: true, altSource: true },
    });
    if (!current || current.postId !== job.postId || current.altSource === "MANUAL") return;
    await tx.postImage.update({
      where: { id: current.id },
      data: { alt: generated.alt, altSource: "AI" },
    });
  });
  return JOB_STATUS.DONE;
}

export const AI_SEO_JOB_STATUS = JOB_STATUS;
