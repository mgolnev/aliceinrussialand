import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteImageFiles } from "@/lib/image-pipeline";
import { touchPostAfterImageChange } from "@/lib/post-image-change";
import { notifyIndexNowPaths } from "@/lib/indexnow";

type Ctx = { params: Promise<{ imageId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { imageId } = await ctx.params;
  const img = await prisma.postImage.findUnique({
    where: { id: imageId },
    include: { post: { select: { slug: true, status: true } } },
  });
  if (!img) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  await deleteImageFiles(img.postId, img.id);
  await prisma.$transaction(async (tx) => {
    await tx.postImage.delete({ where: { id: imageId } });
    await touchPostAfterImageChange(tx, img.postId);
  });
  if (img.post.status === "PUBLISHED") {
    after(() => notifyIndexNowPaths([`/p/${img.post.slug}`, "/"]));
  }
  return NextResponse.json({ ok: true });
}
