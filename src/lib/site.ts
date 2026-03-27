import { prisma } from "./prisma";

export type SocialLink = {
  id: string;
  label: string;
  url: string;
  kind: "telegram" | "behance" | "instagram" | "email" | "other";
};

export async function getSiteSettings() {
  let s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!s) {
    s = await prisma.siteSettings.create({
      data: { id: 1 },
    });
  }
  return s;
}

export function parseSocialLinks(json: string): SocialLink[] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is SocialLink =>
        typeof x === "object" &&
        x !== null &&
        "url" in x &&
        typeof (x as SocialLink).url === "string",
    ) as SocialLink[];
  } catch {
    return [];
  }
}
