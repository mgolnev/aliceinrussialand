import type { SocialImportProvider, SocialPlatform } from "@/lib/social-import/types";
import { instagramProvider } from "@/lib/social-import/providers/instagram";
import { behanceProvider } from "@/lib/social-import/providers/behance";

export function getSocialImportProvider(platform: SocialPlatform): SocialImportProvider {
  if (platform === "instagram") return instagramProvider;
  return behanceProvider;
}
