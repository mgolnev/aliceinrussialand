import { describe, expect, it } from "vitest";
import {
  derivePostTitle,
  extractFirstSentence,
  plainPostPreview,
} from "./post-text";

describe("extractFirstSentence", () => {
  it("восстанавливает границу после точки без пробела (кириллица)", () => {
    expect(extractFirstSentence("Стакан супер.тонкий остальной текст")).toBe(
      "Стакан супер.",
    );
  });

  it("не трогает короткие токены перед точкой (т.к., т.п.)", () => {
    const t = "Важно, т.к. дождь. Продолжение";
    expect(extractFirstSentence(t)).toBe("Важно, т.к.");
  });

  it("не режет example.com по точке", () => {
    const t = "Сайт example.com дальше идёт текст про жизнь.";
    expect(extractFirstSentence(t)).toContain("example.com");
  });

  it("склеенный ! с кириллицей", () => {
    expect(extractFirstSentence("Ого!ужас какой")).toBe("Ого!");
  });
});

describe("derivePostTitle", () => {
  it("из тела с пропущенным пробелом после точки", () => {
    expect(derivePostTitle("", "Стакан супер.тонкий дальше")).toBe(
      "Стакан супер.",
    );
  });

  it("не возвращает старый технический заголовок для пустого текста", () => {
    expect(derivePostTitle("", "")).toBe("Без названия");
  });
});

describe("plainPostPreview", () => {
  it("оставляет подпись ссылки, но убирает Markdown и URL", () => {
    expect(
      plainPostPreview(
        "Встречайте [Волк-дурень](https://aliceinrussialand.ru/p/volk-duren) теперь и на английском.",
      ),
    ).toBe("Встречайте Волк-дурень теперь и на английском.");
  });
});
