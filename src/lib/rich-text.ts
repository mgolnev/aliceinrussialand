/**
 * Небольшой безопасный поднабор Markdown для текста публикаций.
 * В базе остаётся обычная строка: старые посты без разметки продолжают работать.
 */
export type RichTextPart =
  | { type: "text"; value: string }
  | { type: "strong"; children: RichTextPart[] }
  | { type: "em"; children: RichTextPart[] }
  | { type: "strike"; children: RichTextPart[] }
  | { type: "link"; href: string; children: RichTextPart[] };

function appendText(parts: RichTextPart[], value: string) {
  if (!value) return;
  const last = parts.at(-1);
  if (last?.type === "text") {
    last.value += value;
  } else {
    parts.push({ type: "text", value });
  }
}

/** Ссылки в постах не должны уметь запускать javascript: или data:-URL. */
export function safePostHref(value: string): string | null {
  const raw = value.trim();
  if (!/^(https?:\/\/|mailto:)/iu.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    if (url.protocol === "mailto:") return url.href;
  } catch {
    // Некорректный URL остаётся обычным текстом.
  }
  return null;
}

/** Разбирает только разметку, которую умеет создать редактор. */
export function parseRichText(source: string): RichTextPart[] {
  const parts: RichTextPart[] = [];
  let index = 0;

  while (index < source.length) {
    const current = source[index];
    if (current === "\\" && index + 1 < source.length) {
      appendText(parts, source[index + 1]);
      index += 2;
      continue;
    }

    if (current === "[") {
      const labelEnd = source.indexOf("](", index + 1);
      const urlEnd = labelEnd < 0 ? -1 : source.indexOf(")", labelEnd + 2);
      if (labelEnd > index + 1 && urlEnd > labelEnd + 2) {
        const href = safePostHref(source.slice(labelEnd + 2, urlEnd));
        if (href) {
          parts.push({
            type: "link",
            href,
            children: parseRichText(source.slice(index + 1, labelEnd)),
          });
          index = urlEnd + 1;
          continue;
        }
      }
    }

    const marker = source.startsWith("**", index)
      ? "**"
      : source.startsWith("~~", index)
        ? "~~"
        : current === "*" || current === "_"
          ? current
          : null;
    if (marker) {
      const closeAt = source.indexOf(marker, index + marker.length);
      if (closeAt > index + marker.length) {
        const children = parseRichText(source.slice(index + marker.length, closeAt));
        if (marker === "**") parts.push({ type: "strong", children });
        else if (marker === "~~") parts.push({ type: "strike", children });
        else parts.push({ type: "em", children });
        index = closeAt + marker.length;
        continue;
      }
    }

    appendText(parts, current);
    index += 1;
  }

  return parts;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function partsToHtml(parts: RichTextPart[]): string {
  return parts
    .map((part) => {
      if (part.type === "text") return escapeHtml(part.value);
      const children = partsToHtml(part.children);
      if (part.type === "strong") return `<strong>${children}</strong>`;
      if (part.type === "em") return `<em>${children}</em>`;
      if (part.type === "strike") return `<s>${children}</s>`;
      return `<a href="${escapeHtml(part.href)}">${children}</a>`;
    })
    .join("");
}

/** HTML для contenteditable генерируется только из безопасного AST. */
export function richTextToEditorHtml(value: string) {
  return partsToHtml(parseRichText(value)).replace(/\n/g, "<br>");
}

export function richTextToPlainText(value: string) {
  const read = (parts: RichTextPart[]): string =>
    parts
      .map((part) =>
        part.type === "text" ? part.value : read(part.children),
      )
      .join("");
  return read(parseRichText(value));
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\\[\]*_~])/g, "\\$1");
}

/** Превращает ограниченный DOM contenteditable обратно в строку для БД. */
export function editorHtmlToRichText(root: HTMLElement) {
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMarkdownText(node.textContent ?? "");
    }
    if (!(node instanceof HTMLElement)) return "";

    const children = Array.from(node.childNodes).map(read).join("");
    switch (node.tagName) {
      case "BR":
        return "\n";
      case "B":
      case "STRONG":
        return `**${children}**`;
      case "I":
      case "EM":
        return `_${children}_`;
      case "S":
      case "STRIKE":
      case "DEL":
        return `~~${children}~~`;
      case "A": {
        const href = safePostHref(node.getAttribute("href") ?? "");
        return href ? `[${children}](${href})` : children;
      }
      case "DIV":
      case "P":
        return `${children}\n`;
      default:
        return children;
    }
  };

  return Array.from(root.childNodes)
    .map(read)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/g, "");
}
