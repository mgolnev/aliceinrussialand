import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureSiteSettings } from "@/lib/site";
import { invalidateWanderCatalogueCache } from "@/lib/cache-tags";
import {
  normalizeWanderEntryLabel,
  normalizeWanderEntrySubtitle,
  normalizeWanderImageCount,
  normalizeWanderExcludedCategoryIds,
} from "@/lib/wander-settings";

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const excludedCategoryIds = normalizeWanderExcludedCategoryIds(body?.excludedCategoryIds);
  const entryLabel = normalizeWanderEntryLabel(body?.entryLabel);
  // Older open admin forms do not send a subtitle; preserve it in that case.
  const entrySubtitle = body?.entrySubtitle === undefined
    ? undefined
    : normalizeWanderEntrySubtitle(body.entrySubtitle);
  const imageCount = body?.imageCount === undefined
    ? undefined
    : normalizeWanderImageCount(body.imageCount);
  if (
    !body ||
    typeof body.showWanderEntry !== "boolean" ||
    entryLabel === null ||
    entrySubtitle === null ||
    imageCount === null ||
    excludedCategoryIds === null
  ) {
    return NextResponse.json({ error: "Некорректные настройки" }, { status: 400 });
  }

  const existingCategories = excludedCategoryIds.length
    ? await prisma.postCategory.findMany({
        where: { id: { in: excludedCategoryIds } },
        select: { id: true },
      })
    : [];
  const existingIds = new Set(existingCategories.map((category) => category.id));
  const validExcludedCategoryIds = excludedCategoryIds.filter((id) => existingIds.has(id));

  await ensureSiteSettings();
  const [updated] = await prisma.$transaction([
    prisma.siteSettings.update({
      where: { id: 1 },
      data: {
        showWanderEntry: body.showWanderEntry,
        wanderEntryLabel: entryLabel,
        ...(entrySubtitle !== undefined ? { wanderEntrySubtitle: entrySubtitle } : {}),
        ...(imageCount !== undefined ? { wanderImageCount: imageCount } : {}),
      },
      select: { showWanderEntry: true, wanderEntryLabel: true, wanderEntrySubtitle: true, wanderImageCount: true },
    }),
    prisma.postCategory.updateMany({
      data: { includeInWander: true },
    }),
    ...(validExcludedCategoryIds.length
      ? [prisma.postCategory.updateMany({
          where: { id: { in: validExcludedCategoryIds } },
          data: { includeInWander: false },
        })]
      : []),
  ]);

  invalidateWanderCatalogueCache();
  revalidatePath("/");
  revalidatePath("/wander");
  return NextResponse.json({
    showWanderEntry: updated.showWanderEntry,
    entryLabel: updated.wanderEntryLabel,
    entrySubtitle: updated.wanderEntrySubtitle,
    imageCount: updated.wanderImageCount,
    excludedCategoryIds: validExcludedCategoryIds,
  });
}
