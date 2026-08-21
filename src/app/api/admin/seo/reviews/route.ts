import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  applyAiSeoReview,
  dismissAiSeoReview,
  enqueueAiSeoReviews,
  getAiSeoReviewStatus,
  listAiSeoReviewItems,
} from "@/lib/ai-seo-reviews";
import { processAiSeoJobs } from "@/lib/ai-seo-jobs";
import { SEO_REVIEW_PRIORITY } from "@/lib/seo-review";

export const runtime = "nodejs";
export const maxDuration = 60;

async function snapshot() {
  const [status, items] = await Promise.all([
    getAiSeoReviewStatus(),
    listAiSeoReviewItems(),
  ]);
  return { status, items };
}

export async function GET() {
  return NextResponse.json(await snapshot());
}

function revalidateAppliedTarget(target: "POST" | "PROJECT", slug: string) {
  if (target === "POST") {
    revalidatePath(`/p/${slug}`);
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/category/[slug]", "page");
  } else {
    revalidatePath(`/projects/${slug}`);
    revalidatePath("/projects/[slug]", "page");
  }
  revalidatePath("/sitemap.xml");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (body.action === "queue") {
    const priority = body.priority === SEO_REVIEW_PRIORITY.IMPROVE
      ? SEO_REVIEW_PRIORITY.IMPROVE
      : body.priority === SEO_REVIEW_PRIORITY.CRITICAL
        ? SEO_REVIEW_PRIORITY.CRITICAL
        : null;
    if (!priority) {
      return NextResponse.json({ error: "Неизвестный этап улучшений" }, { status: 400 });
    }
    const queued = await enqueueAiSeoReviews(priority);
    if (queued.queued) {
      after(async () => {
        await processAiSeoJobs({ limit: 4 });
      });
    }
    return NextResponse.json({ ok: true, queued, ...(await snapshot()) });
  }

  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Не найдено предложение" }, { status: 400 });
  }

  if (body.action === "apply") {
    const applied = await applyAiSeoReview(body.id);
    if (!applied.ok) {
      return NextResponse.json(
        { error: applied.error, stale: applied.stale ?? false },
        { status: 409 },
      );
    }
    revalidateAppliedTarget(applied.target, applied.slug);
    return NextResponse.json({ ok: true, ...(await snapshot()) });
  }

  if (body.action === "dismiss") {
    const dismissed = await dismissAiSeoReview(body.id);
    if (!dismissed) {
      return NextResponse.json({ error: "Предложение уже недоступно" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...(await snapshot()) });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
