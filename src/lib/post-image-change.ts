import type { Prisma } from "@prisma/client";

type PostTouchClient = Pick<Prisma.TransactionClient, "post">;

/** Обновляет lastmod родительской страницы после любого изменения изображения. */
export async function touchPostAfterImageChange(
  client: PostTouchClient,
  postId: string,
  updatedAt = new Date(),
) {
  await client.post.update({
    where: { id: postId },
    data: { updatedAt },
    select: { id: true },
  });
}
