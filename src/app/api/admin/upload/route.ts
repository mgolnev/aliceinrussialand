import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { processUpload } from "@/lib/image-pipeline";
import { POST_IMAGE_MAX_BYTES } from "@/lib/upload-limits";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const postId = String(form.get("postId") ?? "");
  const file = form.get("file");

  if (!postId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Нужны postId и file" },
      { status: 400 },
    );
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }

  const mime = file.type || "image/jpeg";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Допустимы JPEG, PNG, WebP, GIF" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > POST_IMAGE_MAX_BYTES) {
    const mb = Math.round(POST_IMAGE_MAX_BYTES / (1024 * 1024));
    return NextResponse.json(
      { error: `Файл слишком большой (макс. ${mb} МБ)` },
      { status: 400 },
    );
  }

  const imageId = nanoid();
  let processed: Awaited<ReturnType<typeof processUpload>>;
  try {
    processed = await processUpload({
      buffer,
      mime,
      postId,
      imageId,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FILE_TOO_LARGE") {
      const mb = Math.round(POST_IMAGE_MAX_BYTES / (1024 * 1024));
      return NextResponse.json(
        { error: `Файл слишком большой (макс. ${mb} МБ)` },
        { status: 400 },
      );
    }
    throw e;
  }
  const { originalExt, width, height, variants } = processed;

  const maxOrder = await prisma.postImage.aggregate({
    where: { postId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const row = await prisma.postImage.create({
    data: {
      id: imageId,
      postId,
      sortOrder,
      originalExt,
      width,
      height,
      variantsJson: JSON.stringify(variants),
    },
  });

  return NextResponse.json({
    id: row.id,
    sortOrder: row.sortOrder,
    variants,
    width,
    height,
  });
}
