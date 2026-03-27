import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSiteSettings } from "@/lib/site";
import {
  deleteAvatarMediaFiles,
  processAvatarUpload,
} from "@/lib/image-pipeline";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Нужен file" }, { status: 400 });
  }

  const mime = file.type || "image/jpeg";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Допустимы JPEG, PNG, WebP" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 12 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 12 МБ)" },
      { status: 400 },
    );
  }

  let variants: Record<string, string>;
  try {
    ({ variants } = await processAvatarUpload({ buffer, mime }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка обработки";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const json = JSON.stringify(variants);
  await ensureSiteSettings();
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: { avatarMediaPath: json },
  });

  return NextResponse.json({
    avatarMediaPath: json,
    previewUrl: variants.w256 ?? variants.w512 ?? variants.w128,
  });
}

export async function DELETE() {
  await deleteAvatarMediaFiles();
  await ensureSiteSettings();
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: { avatarMediaPath: null },
  });
  return NextResponse.json({ ok: true });
}
