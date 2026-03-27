import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteImageFiles } from "@/lib/image-pipeline";

type Ctx = { params: Promise<{ imageId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { imageId } = await ctx.params;
  const img = await prisma.postImage.findUnique({ where: { id: imageId } });
  if (!img) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  await deleteImageFiles(img.postId, img.id);
  await prisma.postImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}
