import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftSlug } from "@/lib/slug";
import { POST_STATUS } from "@/lib/constants";

export default async function NewPostPage() {
  const post = await prisma.post.create({
    data: {
      title: "Новый черновик",
      slug: draftSlug(),
      status: POST_STATUS.DRAFT,
    },
  });
  redirect(`/admin/posts/${post.id}/edit`);
}
