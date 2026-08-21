import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { toSlug } from "@/lib/slug";
import { processUpload } from "@/lib/image-pipeline";
import { downloadTelegramImage } from "@/lib/telegram-public";
import { derivePostTitle } from "@/lib/post-text";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { invalidatePublicFeedCache } from "@/lib/cache-tags";
import {
  enqueuePublishedPostAiSeo,
  processAiSeoJobs,
} from "@/lib/ai-seo-jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

function isSourceFieldsCompatError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("sourcePlatform") ||
    msg.includes("sourceUrl") ||
    msg.includes("Unknown arg") ||
    msg.includes("does not exist in the current database")
  );
}

type Item = {
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
  publish?: boolean;
  categoryId?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      items?: Item[];
    } | null;

    if (!body?.items?.length) {
      return NextResponse.json({ error: "Пустой список" }, { status: 400 });
    }

    const created: string[] = [];
    const published: string[] = [];
    const requestedCategoryIds = [
      ...new Set(
        body.items
          .map((item) => item.categoryId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const validCategoryIds = new Set(
      (
        await prisma.postCategory.findMany({
          where: { id: { in: requestedCategoryIds } },
          select: { id: true },
        })
      ).map((category) => category.id),
    );

    for (const item of body.items) {
      const titleLine = derivePostTitle("", item.text || "");

      let base = toSlug(titleLine);
      if (!base) base = `tg-${nanoid(6)}`;

      let slug = base;
      let n = 0;
      while (await prisma.post.findUnique({ where: { slug } })) {
        n += 1;
        slug = `${base}-${n}`;
      }

      const publish = Boolean(item.publish);
      const publishedAt = item.dateIso ? new Date(item.dateIso) : new Date();

      const normUrl = normalizeTelegramPostUrl(item.href);
      const categoryId = item.categoryId?.trim();
      const post = await (async () => {
        try {
          return await prisma.post.create({
            data: {
              title: titleLine,
              slug,
              body: item.text,
              displayMode: "GRID",
              status: publish ? POST_STATUS.PUBLISHED : POST_STATUS.DRAFT,
              publishedAt,
              telegramSourceUrl: normUrl,
              sourcePlatform: "TELEGRAM",
              sourceUrl: normUrl,
              metaTitle: titleLine,
              metaDescription: excerptForMetaDescription(item.text),
              categoryId:
                categoryId && validCategoryIds.has(categoryId)
                  ? categoryId
                  : null,
            },
          });
        } catch (e) {
          if (!isSourceFieldsCompatError(e)) throw e;
          // Совместимость со старыми Prisma Client/БД без source*.
          return await prisma.post.create({
            data: {
              title: titleLine,
              slug,
              body: item.text,
              displayMode: "GRID",
              status: publish ? POST_STATUS.PUBLISHED : POST_STATUS.DRAFT,
              publishedAt,
              telegramSourceUrl: normUrl,
              metaTitle: titleLine,
              metaDescription: excerptForMetaDescription(item.text),
              categoryId:
                categoryId && validCategoryIds.has(categoryId)
                  ? categoryId
                  : null,
            },
          });
        }
      })();

      let order = 0;
      for (const url of item.imageUrls.slice(0, 20)) {
        try {
          const buffer = await downloadTelegramImage(url);
          const mime =
            url.includes(".png") || url.endsWith("png")
              ? "image/png"
              : "image/jpeg";
          const imageId = nanoid();
          const processed = await processUpload({
            buffer,
            mime,
            postId: post.id,
            imageId,
          });
          await prisma.postImage.create({
            data: {
              id: imageId,
              postId: post.id,
              sortOrder: order,
              originalExt: processed.originalExt,
              width: processed.width,
              height: processed.height,
              variantsJson: JSON.stringify(processed.variants),
            },
          });
          order += 1;
        } catch {
          /* пропускаем битые изображения */
        }
      }

      created.push(post.id);
      if (publish) published.push(post.id);
    }

    revalidatePath("/admin/posts");
    if (published.length) invalidatePublicFeedCache();

    if (published.length) {
      const jobIds = (
        await Promise.all(
          published.map((postId) => enqueuePublishedPostAiSeo(postId)),
        )
      ).flatMap((queued) => queued.jobIds);
      if (jobIds.length) {
        after(async () => {
          await processAiSeoJobs({ jobIds, limit: 2 });
        });
      }
    }

    return NextResponse.json({ createdIds: created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось импортировать посты";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
