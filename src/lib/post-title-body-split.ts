/**
 * Та же логика, что на странице поста (PostCard standalone):
 * заголовок — первое предложение из поля title, тело — текст без дубля в начале.
 */

export function firstSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const index = trimmed.search(/[.!?…]/u);
  if (index < 0) return trimmed;
  return trimmed.slice(0, index + 1).trim();
}

/**
 * Первое предложение целиком (как {@link firstSentence}).
 * Если оно длиннее `maxChars` — обрезка по символам с «…» (без переноса середины слова, если удаётся отступить к пробелу).
 */
export function firstSentenceWithCharCap(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const index = trimmed.search(/[.!?…]/u);
  const sentence = index < 0 ? trimmed : trimmed.slice(0, index + 1).trim();
  if (sentence.length <= maxChars) return sentence;

  let cut = sentence.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxChars * 0.55)) {
    cut = cut.slice(0, lastSpace);
  }
  return `${cut.trimEnd()}…`;
}

function normalizedSentence(value: string): string {
  return value
    .trim()
    .replace(/[.!?…]+$/u, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleAsBodyPrefixRegex(title: string): RegExp {
  let pattern = "^";
  for (const ch of title.trim()) {
    if (/\s/u.test(ch)) {
      pattern += "\\s+";
      continue;
    }
    pattern += escapeRegExp(ch);
    if (/[.!?…]/u.test(ch)) {
      pattern += "\\s*";
    }
  }
  return new RegExp(pattern, "u");
}

export function stripLeadingTitleFromBody(body: string, title: string): string {
  const trimmedBody = body.trim();
  const trimmedTitle = title.trim();
  if (!trimmedBody || !trimmedTitle) return body;

  if (trimmedBody.startsWith(trimmedTitle)) {
    const rest = trimmedBody.slice(trimmedTitle.length).trimStart();
    return rest;
  }

  const byTitlePrefix = trimmedBody.match(titleAsBodyPrefixRegex(trimmedTitle));
  if (byTitlePrefix?.[0]) {
    const rest = trimmedBody.slice(byTitlePrefix[0].length).trimStart();
    return rest;
  }

  const sentenceEndIndex = trimmedBody.search(/[.!?…]/u);
  if (sentenceEndIndex < 0) return body;

  const first = trimmedBody.slice(0, sentenceEndIndex + 1);
  if (!first) return body;

  if (normalizedSentence(first) !== normalizedSentence(trimmedTitle)) {
    return body;
  }

  const rest = trimmedBody.slice(first.length).trimStart();
  return rest || body;
}
