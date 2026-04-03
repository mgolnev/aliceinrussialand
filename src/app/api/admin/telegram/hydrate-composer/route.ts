import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { draftSlug } from "@/lib/slug";
import { processUpload, deleteImageFiles } from "@/lib/image-pipeline";
import { downloadTelegramImage } from "@/lib/telegram-public";
import { derivePostTitle } from "@/lib/post-text";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";
import { parseVariants } from "@/lib/posts-query";

export const runtime = "nodejs";
export const maxDuration = 120;

type Item = {
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

function publishedAtFromTelegram(dateIso: string | null): Date | null {
  if (!dateIso?.trim()) return null;
  const d = new Date(dateIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      item?: Item;
      existingPostId?: string | null;
    } | null;

    const item = body?.item;
    if (!item?.href?.trim()) {
      return NextResponse.json({ error: "Нет ссылки на пост" }, { status: 400 });
    }

    const normUrl = normalizeTelegramPostUrl(item.href);
    const title = derivePostTitle("", item.text || "");
    const text = typeof item.text === "string" ? item.text : "";
    const tgPublishedAt = publishedAtFromTelegram(item.dateIso);

    let postId: string;

    if (body?.existingPostId?.trim()) {
      const existing = await prisma.post.findFirst({
        where: {
          id: body.existingPostId.trim(),
          status: POST_STATUS.DRAFT,
        },
        include: { images: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Черновик не найден или уже опубликован" },
          { status: 404 },
        );
      }
      for (const im of existing.images) {
        await deleteImageFiles(existing.id, im.id);
      }
      await prisma.postImage.deleteMany({ where: { postId: existing.id } });
      await prisma.post.update({
        where: { id: existing.id },
        data: {
          body: text,
          title,
          telegramSourceUrl: normUrl,
          metaTitle: "",
          metaDescription: "",
          categoryId: null,
          publishedAt: tgPublishedAt,
        },
      });
      postId = existing.id;
    } else {
      const post = await prisma.post.create({
        data: {
          title,
          slug: draftSlug(),
          body: text,
          displayMode: "GRID",
          status: POST_STATUS.DRAFT,
          telegramSourceUrl: normUrl,
          metaTitle: "",
          metaDescription: "",
          publishedAt: tgPublishedAt,
        },
      });
      postId = post.id;
    }

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
          postId,
          imageId,
        });
        await prisma.postImage.create({
          data: {
            id: imageId,
            postId,
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

    const images = await prisma.postImage.findMany({
      where: { postId },
      orderBy: { sortOrder: "asc" },
    });

    revalidatePath("/admin/posts");

    return NextResponse.json({
      id: postId,
      body: text,
      images: images.map((im) => ({
        id: im.id,
        variants: parseVariants(im.variantsJson),
        width: im.width,
        height: im.height,
        caption: im.caption,
        alt: im.alt,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось импортировать пост";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
