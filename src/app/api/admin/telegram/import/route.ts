import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { toSlug } from "@/lib/slug";
import { processUpload } from "@/lib/image-pipeline";
import { downloadTelegramImage } from "@/lib/telegram-public";
import { derivePostTitle } from "@/lib/post-text";

export const runtime = "nodejs";

type Item = {
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
  publish?: boolean;
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

      const post = await prisma.post.create({
        data: {
          title: titleLine,
          slug,
          body: item.text,
          displayMode: "GRID",
          status: publish ? POST_STATUS.PUBLISHED : POST_STATUS.DRAFT,
          publishedAt,
          telegramSourceUrl: item.href,
          metaTitle: titleLine,
          metaDescription: item.text.slice(0, 160),
        },
      });

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
    }

    return NextResponse.json({ createdIds: created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось импортировать посты";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
