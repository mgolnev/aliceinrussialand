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
