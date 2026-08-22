import fs from "node:fs/promises";
import path from "node:path";

export function getOriginalsRoot() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "storage",
    "originals",
  );
}

export function getPublicMediaDir(postId: string, imageId: string) {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "media",
    postId,
    imageId,
  );
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
