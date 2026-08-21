import { stripEmojiForSeo } from "@/lib/seo-sanitize";

type JsonRecord = Record<string, unknown>;

export type GeneratedPostSeo = {
  title: string;
  description: string;
  confidence: number;
};

export type GeneratedImageAlt = {
  alt: string;
  confidence: number;
};

function plain(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripEmojiForSeo(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.55 ? slice.slice(0, lastSpace) : slice).trim();
}

function confidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.75;
  return Math.max(0, Math.min(1, value));
}

/** Отсекает характерный SEO-спам вроде «керамика керамика керамика». */
function hasExcessiveRepetition(text: string): boolean {
  const counts = new Map<string, number>();
  for (const word of text.toLocaleLowerCase("ru").match(/[\p{L}\p{N}-]{3,}/gu) ?? []) {
    const count = (counts.get(word) ?? 0) + 1;
    counts.set(word, count);
    if (count >= 4) return true;
  }
  return false;
}

/**
 * Модель иногда оборачивает JSON в Markdown или добавляет одну вводную фразу.
 * Берём только внешний объект и никогда не исполняем его как код.
 */
export function parseAiJson(raw: string): JsonRecord | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(first, last + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

export function parseGeneratedPostSeo(raw: string): GeneratedPostSeo | null {
  const value = parseAiJson(raw);
  if (!value) return null;
  const title = clip(plain(value.title), 70);
  const description = clip(plain(value.description), 180);
  if (
    title.length < 8 ||
    description.length < 45 ||
    hasExcessiveRepetition(title) ||
    hasExcessiveRepetition(description)
  ) {
    return null;
  }
  return { title, description, confidence: confidence(value.confidence) };
}

export function parseGeneratedImageAlt(raw: string): GeneratedImageAlt | null {
  const value = parseAiJson(raw);
  if (!value) return null;
  const alt = clip(plain(value.alt), 160);
  if (alt.length < 5 || hasExcessiveRepetition(alt)) return null;
  return { alt, confidence: confidence(value.confidence) };
}
