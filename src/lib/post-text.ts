/** Перед точкой ≥4 букв — не режем «т.к.» и однобуквенные сокращения. */
const WORD_BEFORE_DOT = "(\\p{L}{4,})";
/** Перед !? ≥3 букв — хватает на «Ого!ужас», однобуквенные сокращения не с ! */
const WORD_BEFORE_BANG = "(\\p{L}{3,})";
/** Кириллица после знака — не цепляет «example.com» (там латиница с нижнего регистра). */
const CYR_AFTER = "[\\u0400-\\u04FF]";

/**
 * В чатах часто пишут «слово.слово» без пробела после точки. Вставляем пробел,
 * чтобы основной regexp увидел конец предложения.
 */
function normalizeGluedSentenceBreaks(input: string): string {
  const reDotCyr = new RegExp(`${WORD_BEFORE_DOT}(\\.)(?=${CYR_AFTER})`, "gu");
  const reDotLatinUpper = new RegExp(
    `${WORD_BEFORE_DOT}(\\.)(?=[A-Z])`,
    "gu",
  );
  const reBangCyr = new RegExp(
    `${WORD_BEFORE_BANG}([!?])(?=${CYR_AFTER})`,
    "gu",
  );
  const reBangLat = new RegExp(
    `${WORD_BEFORE_BANG}([!?])(?=[A-Z])`,
    "gu",
  );

  return input
    .replace(reDotCyr, "$1. ")
    .replace(reDotLatinUpper, "$1. ")
    .replace(reBangCyr, "$1$2 ")
    .replace(reBangLat, "$1$2 ");
}

export function extractFirstSentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const forMatch = normalizeGluedSentenceBreaks(clean);

  const sentenceMatch = forMatch.match(/.+?[.!?…](?=\s|$)/);
  if (sentenceMatch?.[0]) {
    return sentenceMatch[0].trim().slice(0, 140);
  }

  return clean.slice(0, 140).trim();
}

export function derivePostTitle(title: string | null | undefined, body: string) {
  const explicit = title?.trim();
  if (explicit) return explicit;

  return extractFirstSentence(body) || "Новая публикация";
}
