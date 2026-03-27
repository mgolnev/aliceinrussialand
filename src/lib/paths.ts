import fs from "node:fs/promises";
import path from "node:path";

export function getProjectRoot() {
  return process.cwd();
}

export function getMediaRoot() {
  const rel = process.env.MEDIA_ROOT ?? "storage/media";
  return path.join(getProjectRoot(), rel);
}

export function getOriginalsRoot() {
  return path.join(getProjectRoot(), "storage/originals");
}

export function getPublicMediaDir(postId: string, imageId: string) {
  return path.join(
    getProjectRoot(),
    "public",
    "media",
    postId,
    imageId,
  );
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
