import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

const MEDIA_ROOT = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public",
  "media",
);

function isSafeSegment(segment: string): boolean {
  return /^[A-Za-z0-9_-]+(?:\.webp)?$/.test(segment);
}

/**
 * В production Next.js строит индекс `public/` один раз при запуске.
 * Новые файлы импорта в примонтированном `public/media` в этот индекс не
 * попадают, поэтому для них нужен route handler, читающий диск на запросе.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;

  if (
    !segments.length ||
    !segments.every(isSafeSegment) ||
    !segments[segments.length - 1]?.endsWith(".webp")
  ) {
    return new Response(null, { status: 404 });
  }

  const filePath = path.resolve(MEDIA_ROOT, ...segments);
  if (!filePath.startsWith(`${MEDIA_ROOT}${path.sep}`)) {
    return new Response(null, { status: 404 });
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return new Response(null, { status: 404 });

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    const isPostImage = segments.length === 3;
    return new Response(stream, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(stat.size),
        // У post-image URL есть уникальный imageId. avatar/about-photo
        // перезаписываются по прежнему адресу, поэтому их не кешируем надолго.
        "Cache-Control": isPostImage
          ? "public, max-age=31536000, immutable"
          : "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}
