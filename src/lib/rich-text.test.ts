import { describe, expect, it } from "vitest";
import {
  editorHtmlToRichText,
  parseRichText,
  richTextToEditorHtml,
  richTextToPlainText,
  safePostHref,
} from "./rich-text";

describe("rich post text", () => {
  it("parses all formatting supported by the composer", () => {
    const source = "**жирный** _курсив_ ~~старое~~ [ссылка](https://example.com/page)";
    expect(richTextToPlainText(source)).toBe("жирный курсив старое ссылка");
    expect(richTextToEditorHtml(source)).toContain("<strong>жирный</strong>");
    expect(richTextToEditorHtml(source)).toContain('<a href="https://example.com/page">ссылка</a>');
    expect(parseRichText(source)).toHaveLength(7);
  });

  it("does not turn unsafe URLs into links", () => {
    expect(safePostHref("javascript:alert(1)")).toBeNull();
    expect(safePostHref("example.com")).toBeNull();
    expect(richTextToPlainText("[опасно](javascript:alert(1))")).toContain("опасно");
  });

  it("allows internal links to posts and work collections", () => {
    expect(safePostHref("/projects/volk-durak")).toBe("/projects/volk-durak");
    expect(safePostHref("/p/poisk-volka")).toBe("/p/poisk-volka");
    expect(safePostHref("/admin/projects")).toBeNull();
  });

  it("serializes only allowed editable tags back to markup", () => {
    const root = document.createElement("div");
    root.innerHTML = "<strong>Важно</strong> и <em>точно</em><br><a href='https://example.com'>источник</a>";
    expect(editorHtmlToRichText(root)).toBe("**Важно** и _точно_\n[источник](https://example.com/)");
  });

  it("keeps line breaks when Chrome creates block elements on Enter", () => {
    const root = document.createElement("div");
    root.innerHTML = "Первая строка<div>Вторая строка</div><div>Третья строка</div>";

    expect(editorHtmlToRichText(root)).toBe(
      "Первая строка\nВторая строка\nТретья строка",
    );
  });

  it("keeps an empty paragraph created between two lines", () => {
    const root = document.createElement("div");
    root.innerHTML = "Первая строка<div><br></div><div>Третья строка</div>";

    expect(editorHtmlToRichText(root)).toBe(
      "Первая строка\n\nТретья строка",
    );
  });
});
