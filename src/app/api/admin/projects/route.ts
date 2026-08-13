import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/slug";
import { PROJECT_STATUS } from "@/lib/projects";

async function uniqueSlug(input: string) {
  const base = toSlug(input);
  let slug = base;
  let n = 2;
  while (await prisma.project.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function GET() {
  const items = await prisma.project.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { posts: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Укажите название цикла" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      title,
      slug: await uniqueSlug(title),
      status: PROJECT_STATUS.DRAFT,
    },
    select: { id: true, slug: true },
  });
  revalidatePath("/admin/projects");
  return NextResponse.json(project, { status: 201 });
}
