export const SOCIAL_KINDS = [
  "telegram",
  "instagram",
  "youtube",
  "pinterest",
  "vk",
  "facebook",
  "x",
  "linkedin",
  "behance",
  "dribbble",
  "tiktok",
  "threads",
  "github",
  "email",
  "other",
] as const;

export type SocialKind = (typeof SOCIAL_KINDS)[number];

export const SOCIAL_KIND_OPTIONS: { value: SocialKind; label: string }[] = [
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
  { value: "vk", label: "ВКонтакте" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "behance", label: "Behance" },
  { value: "dribbble", label: "Dribbble" },
  { value: "tiktok", label: "TikTok" },
  { value: "threads", label: "Threads" },
  { value: "github", label: "GitHub" },
  { value: "email", label: "Почта" },
  { value: "other", label: "Другое" },
];

export function isSocialKind(x: unknown): x is SocialKind {
  return (
    typeof x === "string" &&
    (SOCIAL_KINDS as readonly string[]).includes(x)
  );
}

/** Если в JSON неверный kind или старые данные — подбираем по URL. */
export function socialKindLabel(kind: SocialKind): string {
  return SOCIAL_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? "Ссылка";
}

export function inferSocialKindFromUrl(urlStr: string): SocialKind {
  const raw = urlStr.trim().toLowerCase();
  if (raw.startsWith("mailto:")) return "email";

  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();

    if (h === "t.me" || h === "telegram.me" || h === "telegram.dog")
      return "telegram";
    if (h.endsWith("instagram.com")) return "instagram";
    if (h.includes("pinterest.") || h === "pin.it") return "pinterest";
    if (h === "youtu.be" || h.endsWith("youtube.com")) return "youtube";
    if (h === "vk.com" || h === "vk.ru" || h.endsWith(".vk.com")) return "vk";
    if (
      h === "facebook.com" ||
      h === "fb.com" ||
      h === "m.me" ||
      h.endsWith(".facebook.com")
    )
      return "facebook";
    if (h === "twitter.com" || h === "x.com" || h.endsWith(".twitter.com"))
      return "x";
    if (h.endsWith("linkedin.com")) return "linkedin";
    if (h.endsWith("behance.net")) return "behance";
    if (h.endsWith("dribbble.com")) return "dribbble";
    if (h.endsWith("tiktok.com")) return "tiktok";
    if (h.endsWith("threads.net")) return "threads";
    if (h === "github.com" || h.endsWith(".github.com")) return "github";
  } catch {
    /* ignore */
  }
  return "other";
}
