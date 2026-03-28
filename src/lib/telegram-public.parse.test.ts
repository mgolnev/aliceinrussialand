import { describe, expect, it } from "vitest";
import { parseMessages } from "./telegram-public";

describe("parseMessages / текст поста", () => {
  it("не дублирует вложенные .tgme_widget_message_text", () => {
    const html = `
      <div class="tgme_widget_message" data-post="ch/1">
        <a class="tgme_widget_message_date" href="https://t.me/ch/1"><time datetime="2024-01-01"></time></a>
        <div class="tgme_widget_message_text">
          <div class="tgme_widget_message_text">Один абзац без повтора.</div>
        </div>
      </div>`;
    const items = parseMessages(html, "ch", 5);
    expect(items[0]?.text).toBe("Один абзац без повтора.");
  });

  it("убирает двойной абзац с тем же текстом", () => {
    const html = `
      <div class="tgme_widget_message" data-post="ch/2">
        <a class="tgme_widget_message_date" href="https://t.me/ch/2"><time datetime="2024-01-02"></time></a>
        <div class="tgme_widget_message_text">Повтор


Повтор</div>
      </div>`;
    const items = parseMessages(html, "ch", 5);
    expect(items[0]?.text.trim()).toBe("Повтор");
  });

  it("два разных листа склеивает через пустую строку", () => {
    const html = `
      <div class="tgme_widget_message" data-post="ch/3">
        <a class="tgme_widget_message_date" href="https://t.me/ch/3"><time datetime="2024-01-03"></time></a>
        <div class="tgme_widget_message_text">А</div>
        <div class="tgme_widget_message_text">Б</div>
      </div>`;
    const items = parseMessages(html, "ch", 5);
    expect(items[0]?.text).toBe("А\n\nБ");
  });
});
