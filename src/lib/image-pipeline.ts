import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, getOriginalsRoot, getPublicMediaDir } from "./paths";
import {
  deleteSupabaseImageFolder,
  isSupabaseMediaEnabled,
  supabasePublicMediaBase,
  uploadSupabaseFile,
} from "./supabase-storage";

const MAX_ORIGINAL_WIDTH = 2560;
const VARIANTS = [640, 960, 1280] as const;

export type VariantsMap = Record<string, string>;

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function buildFinalBuffer(buffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const meta = await sharp(buffer).rotate().metadata();
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;

  if (width > MAX_ORIGINAL_WIDTH) {
    const resized = await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_ORIGINAL_WIDTH,
        withoutEnlargement: true,
      })
      .toBuffer({ resolveWithObject: true });
    return {
      data: resized.data,
      width: resized.info.width ?? width,
      height: resized.info.height ?? height,
    };
  }

  return { data: buffer, width, height };
}

export async function processUpload(params: {
  buffer: Buffer;
  mime: string;
  postId: string;
  imageId: string;
}): Promise<{
  originalExt: string;
  width: number;
  height: number;
  variants: VariantsMap;
}> {
  const { buffer, mime, postId, imageId } = params;
  const originalExt = extFromMime(mime);

  const { data: finalBuf, width, height } = await buildFinalBuffer(buffer);

  if (isSupabaseMediaEnabled()) {
    const variants: VariantsMap = {};
    const publicBase = supabasePublicMediaBase();

    for (const w of VARIANTS) {
      const fname = `w${w}.webp`;
      const objectPath = `${postId}/${imageId}/${fname}`;
      const webpBuf = await sharp(finalBuf)
        .rotate()
        .resize({
          width: w,
          height: w,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      await uploadSupabaseFile(objectPath, webpBuf, "image/webp");
      variants[`w${w}`] = `${publicBase}/${objectPath}`;
    }

    return { originalExt, width, height, variants };
  }

  await ensureDir(getOriginalsRoot());
  const origPath = path.join(
    getOriginalsRoot(),
    `${imageId}.${originalExt}`,
  );
  await fs.writeFile(origPath, finalBuf);

  const outDir = getPublicMediaDir(postId, imageId);
  await ensureDir(outDir);

  const variants: VariantsMap = {};

  for (const w of VARIANTS) {
    const fname = `w${w}.webp`;
    const fpath = path.join(outDir, fname);
    await sharp(finalBuf)
      .rotate()
      .resize({
        width: w,
        height: w,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(fpath);
    variants[`w${w}`] = `/media/${postId}/${imageId}/${fname}`;
  }

  return { originalExt, width, height, variants };
}

export async function deleteImageFiles(postId: string, imageId: string) {
  if (isSupabaseMediaEnabled()) {
    await deleteSupabaseImageFolder(postId, imageId);
    return;
  }

  const dir = getPublicMediaDir(postId, imageId);
  await fs.rm(dir, { recursive: true, force: true });
  const origDir = getOriginalsRoot();
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    await fs.unlink(path.join(origDir, `${imageId}.${ext}`)).catch(() => {});
  }
}
