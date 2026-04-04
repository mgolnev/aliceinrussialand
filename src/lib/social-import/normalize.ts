import type { SocialPlatform } from "@/lib/social-import/types";

function trimSlash(url: string): string {
  let s = url.trim();
  while (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function normalizeInstagramPostUrl(url: string): string {
  return trimSlash(url).replace(/^http:\/\//i, "https://");
}

export function normalizeBehanceProjectUrl(url: string): string {
  return trimSlash(url).replace(/^http:\/\//i, "https://");
}

export function normalizeSourceUrl(platform: SocialPlatform, url: string): string {
  if (platform === "instagram") return normalizeInstagramPostUrl(url);
  return normalizeBehanceProjectUrl(url);
}
