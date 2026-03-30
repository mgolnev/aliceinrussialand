import { extractFirstSentence } from "./post-text";
import { stripEmojiForSeo } from "./seo-sanitize";

const DEFAULT_MAX = 160;
/** Мин. длина первого предложения, чтобы взять его как description вместо всего текста. */
const FIRST_SENTENCE_MIN = 12;

function trimToWordBoundary(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const slice = normalized.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.25) {
    return slice.slice(0, lastSpace).trimEnd();
  }
  return slice.trimEnd();
}

/**
 * Meta description: без эмодзи, по возможности **первое предложение** (спокойнее для выдачи,
 * чем обрезка посреди шутки). Иначе — прежняя логика по длине.
 */
export function excerptForMetaDescription(
  raw: string,
  maxLen: number = DEFAULT_MAX,
): string {
  const stripped = stripEmojiForSeo(raw);
  if (!stripped) return "";

  const first = extractFirstSentence(stripped);
  const useFirst =
    first.length >= FIRST_SENTENCE_MIN && first.length <= maxLen + 40;

  const base = useFirst ? first : stripped;
  return trimToWordBoundary(base, maxLen);
}
