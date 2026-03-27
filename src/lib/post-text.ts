export function extractFirstSentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const sentenceMatch = clean.match(/.+?[.!?…](?=\s|$)/);
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
