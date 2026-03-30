import { describe, expect, it } from "vitest";
import { excerptForMetaDescription } from "./meta-excerpt";

describe("excerptForMetaDescription", () => {
  it("берёт первое предложение и убирает эмодзи (разговорный длинный текст)", () => {
    const body =
      "Стакан достойный порции кофеина. Иногда - можно. Только не рассказывайте моему гастроэнтерологу тсссс! 🤫";
    expect(excerptForMetaDescription(body)).toBe(
      "Стакан достойный порции кофеина.",
    );
  });

  it("короткое первое предложение — берётся весь очищенный текст до лимита", () => {
    const body = "Ок. Но дальше идёт длинное продолжение про жизнь и творчество автора.";
    const out = excerptForMetaDescription(body, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.startsWith("Ок.")).toBe(true);
  });
});
