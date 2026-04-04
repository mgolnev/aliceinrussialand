import { nanoid } from "nanoid";
import { POST_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { processUpload } from "@/lib/image-pipeline";
import { toSlug } from "@/lib/slug";
import { derivePostTitle } from "@/lib/post-text";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { normalizeSourceUrl } from "@/lib/social-import/normalize";
import type {
  SocialImportItem,
  SocialPlatform,
} from "@/lib/social-import/types";

type ImportItemsArgs = {
  platform: SocialPlatform;
  items: SocialImportItem[];
  publish: boolean;
  downloadImage: (url: string) => Promise<Buffer>;
};

type SourcePlatformDb = "INSTAGRAM" | "BEHANCE";

const DB_PLATFORM: Record<SocialPlatform, SourcePlatformDb> = {
  instagram: "INSTAGRAM",
  behance: "BEHANCE",
};

function isSourceFieldsCompatError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("sourcePlatform") ||
    msg.includes("sourceUrl") ||
    msg.includes("sourceExternalId") ||
    msg.includes("Unknown arg") ||
    msg.includes("does not exist in the current database")
  );
}

function imageMime(url: string): string {
  const u = url.toLowerCase();
  if (u.includes(".png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  if (u.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

async function ensureUniqueSlug(rawBase: string): Promise<string> {
  let base = toSlug(rawBase);
  if (!base) base = `social-${nanoid(6)}`;
  let slug = base;
  let n = 0;
  while (await prisma.post.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

function expandedUrlCandidates(url: string): string[] {
  const norm = url.trim();
  if (!norm) return [];
  const noSlash = norm.endsWith("/") ? norm.slice(0, -1) : norm;
  const withSlash = noSlash ? `${noSlash}/` : norm;
  return [...new Set([norm, noSlash, withSlash])].filter(Boolean);
}

export async function listAlreadyImportedSourceUrls(
  platform: SocialPlatform,
  sourceUrls: string[],
): Promise<string[]> {
  const normalized = [...new Set(sourceUrls.map((u) => normalizeSourceUrl(platform, u)))];
  if (!normalized.length) return [];
  const expanded = [...new Set(normalized.flatMap((u) => expandedUrlCandidates(u)))];
  const rows = await (async () => {
    try {
      return await prisma.post.findMany({
        where: {
          sourcePlatform: DB_PLATFORM[platform],
          sourceUrl: { in: expanded },
        },
        select: { sourceUrl: true },
      });
    } catch (e) {
      if (!isSourceFieldsCompatError(e)) throw e;
      // В legacy-схеме source-полей нет: не можем показать "уже импортировано".
      return [];
    }
  })();
  return [
    ...new Set(
      rows
        .map((r) => (r.sourceUrl ? normalizeSourceUrl(platform, r.sourceUrl) : ""))
        .filter(Boolean),
    ),
  ];
}

export async function importSocialItems(args: ImportItemsArgs): Promise<{
  createdIds: string[];
}> {
  const createdIds: string[] = [];
  const status = args.publish ? POST_STATUS.PUBLISHED : POST_STATUS.DRAFT;

  for (const item of args.items) {
    const sourceUrl = normalizeSourceUrl(args.platform, item.href);
    const sourceExternalId = item.externalId?.trim() || null;
    const existing = await (async () => {
      try {
        return await prisma.post.findFirst({
          where: {
            sourcePlatform: DB_PLATFORM[args.platform],
            OR: [
              { sourceUrl: { in: expandedUrlCandidates(sourceUrl) } },
              sourceExternalId ? { sourceExternalId } : undefined,
            ].filter(Boolean) as {
              sourceUrl?: { in: string[] };
              sourceExternalId?: string;
            }[],
          },
          select: { id: true },
        });
      } catch (e) {
        if (!isSourceFieldsCompatError(e)) throw e;
        // В legacy-схеме дедуп по source-полям невозможен.
        return null;
      }
    })();
    if (existing) continue;

    const title = derivePostTitle("", item.text || "");
    const slug = await ensureUniqueSlug(title);
    const publishedAt = item.dateIso ? new Date(item.dateIso) : new Date();

    const post = await (async () => {
      try {
        return await prisma.post.create({
          data: {
            title,
            slug,
            body: item.text,
            displayMode: "GRID",
            status,
            publishedAt,
            sourcePlatform: DB_PLATFORM[args.platform],
            sourceUrl,
            sourceExternalId,
            metaTitle: title,
            metaDescription: excerptForMetaDescription(item.text),
          },
          select: { id: true },
        });
      } catch (e) {
        if (!isSourceFieldsCompatError(e)) throw e;
        // Совместимость со старыми Prisma Client/БД без source*.
        return await prisma.post.create({
          data: {
            title,
            slug,
            body: item.text,
            displayMode: "GRID",
            status,
            publishedAt,
            metaTitle: title,
            metaDescription: excerptForMetaDescription(item.text),
          },
          select: { id: true },
        });
      }
    })();

    let order = 0;
    for (const url of item.imageUrls.slice(0, 20)) {
      try {
        const buffer = await args.downloadImage(url);
        const imageId = nanoid();
        const processed = await processUpload({
          buffer,
          mime: imageMime(url),
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
        // Не прерываем импорт поста из-за битого отдельного изображения.
      }
    }

    createdIds.push(post.id);
  }

  return { createdIds };
}
