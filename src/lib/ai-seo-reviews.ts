import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import {
  generatePostSeo,
  generateProjectSeo,
  type AiSeoPostInput,
  type AiSeoProjectInput,
} from "@/lib/ai-seo";
import {
  assessPostSeoForReview,
  buildSeoTitleDuplicateCounts,
  compactSeoText,
  publishedProjectNeedsSeoReview,
  SEO_REVIEW_PRIORITY,
  type SeoReviewPriority,
} from "@/lib/seo-review";

const REVIEW_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  READY: "READY",
  APPLIED: "APPLIED",
  DISMISSED: "DISMISSED",
  FAILED: "FAILED",
} as const;

type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
type ReviewTarget = "POST" | "PROJECT";

type ReviewCandidate = {
  key: string;
  target: ReviewTarget;
  targetId: string;
  priority: SeoReviewPriority;
  inputHash: string;
  flags: string[];
  currentTitle: string;
  currentDescription: string;
  url: string;
  label: string;
  generatorInput: AiSeoPostInput | AiSeoProjectInput;
};

type ReviewRecord = {
  id: string;
  postId: string | null;
  projectId: string | null;
  priority: string;
  status: string;
  revision: number;
  inputHash: string;
  suggestedTitle: string;
  suggestedDescription: string;
  confidence: number;
  lastError: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AiSeoReviewBucket = {
  total: number;
  unresolved: number;
  pending: number;
  running: number;
  ready: number;
  failed: number;
  resolved: number;
};

export type AiSeoReviewStatus = {
  critical: AiSeoReviewBucket;
  improve: AiSeoReviewBucket;
};

export type AiSeoReviewItem = {
  id: string;
  target: ReviewTarget;
  priority: SeoReviewPriority;
  status: ReviewStatus;
  label: string;
  url: string;
  currentTitle: string;
  currentDescription: string;
  suggestedTitle: string;
  suggestedDescription: string;
  confidence: number;
  flags: string[];
  stale: boolean;
  error: string;
};

export type AiSeoReviewProcessSummary = {
  claimed: number;
  ready: number;
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

function candidateKey(target: ReviewTarget, targetId: string): string {
  return `${target}:${targetId}`;
}

function emptyBucket(): AiSeoReviewBucket {
  return {
    total: 0,
    unresolved: 0,
    pending: 0,
    running: 0,
    ready: 0,
    failed: 0,
    resolved: 0,
  };
}

function authorName(settings: { authorName: string; displayName: string } | null) {
  return settings?.authorName.trim() || settings?.displayName.trim() || "Алиса Гольнева";
}

async function listReviewCandidates(): Promise<ReviewCandidate[]> {
  const [posts, projects, settings] = await Promise.all([
    prisma.post.findMany({
      where: { status: POST_STATUS.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        metaTitle: true,
        metaDescription: true,
        category: { select: { name: true } },
        projects: { select: { project: { select: { title: true } } } },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 2,
          select: { alt: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: POST_STATUS.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        metaTitle: true,
        metaDescription: true,
        posts: {
          orderBy: { sortOrder: "asc" },
          where: { post: { status: POST_STATUS.PUBLISHED } },
          select: {
            post: {
              select: {
                title: true,
                body: true,
                category: { select: { name: true } },
                images: {
                  orderBy: { sortOrder: "asc" },
                  take: 2,
                  select: { alt: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { authorName: true, displayName: true },
    }),
  ]);

  const fullAuthorName = authorName(settings);
  const titleDuplicateCounts = buildSeoTitleDuplicateCounts(
    posts.map((post) => post.metaTitle),
  );
  const result: ReviewCandidate[] = [];

  for (const post of posts) {
    const title = compactSeoText(post.metaTitle);
    const description = compactSeoText(post.metaDescription);
    const duplicateTitleCount = titleDuplicateCounts.get(title.toLocaleLowerCase("ru")) ?? 0;
    const assessment = assessPostSeoForReview({
      metaTitle: title,
      metaDescription: description,
      duplicateTitleCount,
    });
    if (!assessment.priority) continue;

    const generatorInput: AiSeoPostInput = {
      authorName: fullAuthorName,
      title: post.title,
      body: post.body,
      categoryName: post.category?.name ?? null,
      projectTitles: post.projects.map(({ project }) => project.title),
      imageAlts: post.images.map((image) => image.alt),
    };
    const inputHash = hash({
      generatorInput,
      currentTitle: title,
      currentDescription: description,
    });
    result.push({
      key: candidateKey("POST", post.id),
      target: "POST",
      targetId: post.id,
      priority: assessment.priority,
      inputHash,
      flags: assessment.flags,
      currentTitle: title,
      currentDescription: description,
      url: `/p/${post.slug}`,
      label: post.title || "Публикация",
      generatorInput,
    });
  }

  for (const project of projects) {
    if (!publishedProjectNeedsSeoReview(project)) continue;
    const title = compactSeoText(project.metaTitle);
    const description = compactSeoText(project.metaDescription);
    const generatorInput: AiSeoProjectInput = {
      authorName: fullAuthorName,
      title: project.title,
      description: project.description,
      posts: project.posts.map(({ post }) => ({
        title: post.title,
        body: post.body,
        categoryName: post.category?.name ?? null,
        imageAlts: post.images.map((image) => image.alt),
      })),
    };
    result.push({
      key: candidateKey("PROJECT", project.id),
      target: "PROJECT",
      targetId: project.id,
      priority: SEO_REVIEW_PRIORITY.CRITICAL,
      inputHash: hash({
        generatorInput,
        currentTitle: title,
        currentDescription: description,
      }),
      flags: [
        !title ? "Не задан SEO title" : "",
        !description ? "Не задан SEO description" : "",
      ].filter(Boolean),
      currentTitle: title,
      currentDescription: description,
      url: `/projects/${project.slug}`,
      label: project.title || "Подборка",
      generatorInput,
    });
  }

  return result;
}

async function listCurrentReviewRecords(candidates: ReviewCandidate[]) {
  const postIds = candidates
    .filter((candidate) => candidate.target === "POST")
    .map((candidate) => candidate.targetId);
  const projectIds = candidates
    .filter((candidate) => candidate.target === "PROJECT")
    .map((candidate) => candidate.targetId);
  if (!postIds.length && !projectIds.length) return [] as ReviewRecord[];
  return prisma.aiSeoReview.findMany({
    where: {
      OR: [
        ...(postIds.length ? [{ postId: { in: postIds } }] : []),
        ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
      ],
    },
    select: {
      id: true,
      postId: true,
      projectId: true,
      priority: true,
      status: true,
      revision: true,
      inputHash: true,
      suggestedTitle: true,
      suggestedDescription: true,
      confidence: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function recordsByCandidateKey(records: ReviewRecord[]) {
  return new Map(
    records.map((review) => [
      candidateKey(review.postId ? "POST" : "PROJECT", review.postId ?? review.projectId ?? ""),
      review,
    ]),
  );
}

export async function getAiSeoReviewStatus(): Promise<AiSeoReviewStatus> {
  const candidates = await listReviewCandidates();
  const records = await listCurrentReviewRecords(candidates);
  const recordsByKey = recordsByCandidateKey(records);
  const status: AiSeoReviewStatus = {
    critical: emptyBucket(),
    improve: emptyBucket(),
  };

  for (const candidate of candidates) {
    const bucket = candidate.priority === SEO_REVIEW_PRIORITY.CRITICAL
      ? status.critical
      : status.improve;
    bucket.total += 1;
    const review = recordsByKey.get(candidate.key);
    const currentReview = review?.inputHash === candidate.inputHash ? review : null;
    if (!currentReview) {
      bucket.unresolved += 1;
      continue;
    }
    if (
      currentReview.status === REVIEW_STATUS.APPLIED ||
      currentReview.status === REVIEW_STATUS.DISMISSED
    ) {
      bucket.resolved += 1;
      continue;
    }

    bucket.unresolved += 1;
    if (currentReview.status === REVIEW_STATUS.PENDING) bucket.pending += 1;
    if (currentReview.status === REVIEW_STATUS.RUNNING) bucket.running += 1;
    if (currentReview.status === REVIEW_STATUS.READY) bucket.ready += 1;
    if (currentReview.status === REVIEW_STATUS.FAILED) bucket.failed += 1;
  }
  return status;
}

export async function enqueueAiSeoReviews(priority: SeoReviewPriority): Promise<{
  queued: number;
  skipped: number;
}> {
  const candidates = (await listReviewCandidates()).filter(
    (candidate) => candidate.priority === priority,
  );
  const recordsByKey = recordsByCandidateKey(
    await listCurrentReviewRecords(candidates),
  );
  let queued = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const existing = recordsByKey.get(candidate.key);
    const sameInput = existing?.inputHash === candidate.inputHash;
    const keepExisting: ReviewStatus[] = [
        REVIEW_STATUS.PENDING,
        REVIEW_STATUS.RUNNING,
        REVIEW_STATUS.READY,
        REVIEW_STATUS.APPLIED,
        REVIEW_STATUS.DISMISSED,
      ];
    if (sameInput && existing && keepExisting.includes(existing.status as ReviewStatus)) {
      skipped += 1;
      continue;
    }

    const base = {
      priority: candidate.priority,
      status: REVIEW_STATUS.PENDING,
      inputHash: candidate.inputHash,
      suggestedTitle: "",
      suggestedDescription: "",
      confidence: 0,
      attempts: 0,
      runAfter: new Date(),
      lockedAt: null,
      completedAt: null,
      appliedAt: null,
      dismissedAt: null,
      lastError: "",
    };
    if (candidate.target === "POST") {
      await prisma.aiSeoReview.upsert({
        where: { postId: candidate.targetId },
        create: { postId: candidate.targetId, revision: 1, ...base },
        update: { ...base, revision: { increment: 1 } },
      });
    } else {
      await prisma.aiSeoReview.upsert({
        where: { projectId: candidate.targetId },
        create: { projectId: candidate.targetId, revision: 1, ...base },
        update: { ...base, revision: { increment: 1 } },
      });
    }
    queued += 1;
  }
  return { queued, skipped };
}

export async function processAiSeoReviews(options?: {
  limit?: number;
}): Promise<AiSeoReviewProcessSummary> {
  const result: AiSeoReviewProcessSummary = {
    claimed: 0,
    ready: 0,
    retrying: 0,
    failed: 0,
  };
  const limit = Math.max(1, Math.min(options?.limit ?? 4, 12));
  const now = new Date();
  const expiredLock = new Date(Date.now() - 10 * 60_000);
  await prisma.aiSeoReview.updateMany({
    where: { status: REVIEW_STATUS.RUNNING, lockedAt: { lt: expiredLock } },
    data: { status: REVIEW_STATUS.PENDING, lockedAt: null, runAfter: now },
  });

  const jobs = await prisma.aiSeoReview.findMany({
    where: { status: REVIEW_STATUS.PENDING, runAfter: { lte: now } },
    orderBy: [{ priority: "asc" }, { runAfter: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });
  if (!jobs.length) return result;

  const candidatesByKey = new Map(
    (await listReviewCandidates()).map((candidate) => [candidate.key, candidate]),
  );
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { authorName: true, displayName: true },
  });
  const fullAuthorName = authorName(settings);

  for (const listed of jobs) {
    const claim = await prisma.aiSeoReview.updateMany({
      where: {
        id: listed.id,
        status: REVIEW_STATUS.PENDING,
        runAfter: { lte: new Date() },
      },
      data: {
        status: REVIEW_STATUS.RUNNING,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    result.claimed += 1;
    const review = await prisma.aiSeoReview.findUnique({ where: { id: listed.id } });
    if (!review) continue;
    const target = review.postId ? "POST" : "PROJECT";
    const targetId = review.postId ?? review.projectId;
    const candidate = targetId
      ? candidatesByKey.get(candidateKey(target, targetId))
      : undefined;

    if (!candidate) {
      await prisma.aiSeoReview.updateMany({
        where: { id: review.id, revision: review.revision, status: REVIEW_STATUS.RUNNING },
        data: {
          status: REVIEW_STATUS.DISMISSED,
          lockedAt: null,
          completedAt: new Date(),
          lastError: "Задача больше не актуальна",
        },
      });
      continue;
    }
    if (candidate.inputHash !== review.inputHash) {
      await prisma.aiSeoReview.updateMany({
        where: { id: review.id, revision: review.revision, status: REVIEW_STATUS.RUNNING },
        data: {
          priority: candidate.priority,
          status: REVIEW_STATUS.PENDING,
          revision: { increment: 1 },
          inputHash: candidate.inputHash,
          suggestedTitle: "",
          suggestedDescription: "",
          confidence: 0,
          attempts: 0,
          runAfter: new Date(),
          lockedAt: null,
          completedAt: null,
          lastError: "Текст изменился — предложение обновляется",
        },
      });
      result.retrying += 1;
      continue;
    }

    try {
      const input = { ...candidate.generatorInput, authorName: fullAuthorName };
      const generated = candidate.target === "POST"
        ? await generatePostSeo(input as AiSeoPostInput)
        : await generateProjectSeo(input as AiSeoProjectInput);
      if (!generated) throw new Error("AI вернул непригодный SEO-текст");

      const saved = await prisma.aiSeoReview.updateMany({
        where: { id: review.id, revision: review.revision, status: REVIEW_STATUS.RUNNING },
        data: {
          status: REVIEW_STATUS.READY,
          suggestedTitle: generated.title,
          suggestedDescription: generated.description,
          confidence: generated.confidence,
          lockedAt: null,
          completedAt: new Date(),
          lastError: "",
        },
      });
      if (saved.count) result.ready += 1;
    } catch (error) {
      const permanent = review.attempts >= 3 || safeError(error).includes("не настроен");
      const nextStatus = permanent ? REVIEW_STATUS.FAILED : REVIEW_STATUS.PENDING;
      const saved = await prisma.aiSeoReview.updateMany({
        where: { id: review.id, revision: review.revision, status: REVIEW_STATUS.RUNNING },
        data: {
          status: nextStatus,
          lockedAt: null,
          lastError: safeError(error),
          runAfter: permanent ? new Date() : retryDate(review.attempts),
        },
      });
      if (saved.count) {
        if (permanent) result.failed += 1;
        else result.retrying += 1;
      }
    }
  }
  return result;
}

export async function listAiSeoReviewItems(): Promise<AiSeoReviewItem[]> {
  const candidates = await listReviewCandidates();
  const candidatesByKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const records = await prisma.aiSeoReview.findMany({
    where: { status: { in: [REVIEW_STATUS.READY, REVIEW_STATUS.PENDING, REVIEW_STATUS.RUNNING, REVIEW_STATUS.FAILED] } },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 32,
    select: {
      id: true,
      postId: true,
      projectId: true,
      priority: true,
      status: true,
      inputHash: true,
      suggestedTitle: true,
      suggestedDescription: true,
      confidence: true,
      lastError: true,
    },
  });
  return records.map((review) => {
    const target = review.postId ? "POST" : "PROJECT";
    const targetId = review.postId ?? review.projectId ?? "";
    const candidate = candidatesByKey.get(candidateKey(target, targetId));
    return {
      id: review.id,
      target,
      priority: review.priority === SEO_REVIEW_PRIORITY.IMPROVE
        ? SEO_REVIEW_PRIORITY.IMPROVE
        : SEO_REVIEW_PRIORITY.CRITICAL,
      status: review.status as ReviewStatus,
      label: candidate?.label ?? "Материал больше не доступен",
      url: candidate?.url ?? "",
      currentTitle: candidate?.currentTitle ?? "",
      currentDescription: candidate?.currentDescription ?? "",
      suggestedTitle: review.suggestedTitle,
      suggestedDescription: review.suggestedDescription,
      confidence: review.confidence,
      flags: candidate?.flags ?? [],
      stale: !candidate || candidate.inputHash !== review.inputHash,
      error: review.lastError,
    };
  });
}

export async function applyAiSeoReview(id: string): Promise<
  | { ok: true; target: ReviewTarget; slug: string }
  | { ok: false; error: string; stale?: boolean }
> {
  const [review, candidates] = await Promise.all([
    prisma.aiSeoReview.findUnique({ where: { id } }),
    listReviewCandidates(),
  ]);
  if (!review || review.status !== REVIEW_STATUS.READY) {
    return { ok: false, error: "Предложение уже недоступно" };
  }
  const target = review.postId ? "POST" : "PROJECT";
  const targetId = review.postId ?? review.projectId;
  const candidate = targetId
    ? candidates.find((item) => item.key === candidateKey(target, targetId))
    : undefined;
  if (!candidate || candidate.inputHash !== review.inputHash) {
    return {
      ok: false,
      stale: true,
      error: "Материал изменился. Обновите предложение перед применением.",
    };
  }

  const applied = await prisma.$transaction(async (tx) => {
    const claimed = await tx.aiSeoReview.updateMany({
      where: { id: review.id, revision: review.revision, status: REVIEW_STATUS.READY },
      data: {
        status: REVIEW_STATUS.APPLIED,
        appliedAt: new Date(),
        lastError: "",
      },
    });
    if (!claimed.count) return false;
    if (target === "POST" && review.postId) {
      await tx.post.update({
        where: { id: review.postId },
        data: {
          metaTitle: review.suggestedTitle,
          metaTitleSource: "AI",
          metaDescription: review.suggestedDescription,
          metaDescriptionSource: "AI",
        },
      });
    }
    if (target === "PROJECT" && review.projectId) {
      await tx.project.update({
        where: { id: review.projectId },
        data: {
          metaTitle: review.suggestedTitle,
          metaDescription: review.suggestedDescription,
        },
      });
    }
    return true;
  });
  if (!applied) return { ok: false, error: "Предложение уже изменено в другой вкладке" };
  return { ok: true, target, slug: candidate.url.split("/").filter(Boolean).at(-1) ?? "" };
}

export async function dismissAiSeoReview(id: string): Promise<boolean> {
  const review = await prisma.aiSeoReview.findUnique({ where: { id }, select: { revision: true } });
  if (!review) return false;
  const updated = await prisma.aiSeoReview.updateMany({
    where: { id, revision: review.revision, status: REVIEW_STATUS.READY },
    data: {
      status: REVIEW_STATUS.DISMISSED,
      dismissedAt: new Date(),
      lastError: "Оставлено текущее значение",
    },
  });
  return updated.count > 0;
}

export { REVIEW_STATUS as AI_SEO_REVIEW_STATUS };
