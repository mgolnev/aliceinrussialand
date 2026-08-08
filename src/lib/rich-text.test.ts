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

  it("serializes only allowed editable tags back to markup", () => {
    const root = document.createElement("div");
    root.innerHTML = "<strong>Важно</strong> и <em>точно</em><br><a href='https://example.com'>источник</a>";
    expect(editorHtmlToRichText(root)).toBe("**Важно** и _точно_\n[источник](https://example.com/)");
  });
});
