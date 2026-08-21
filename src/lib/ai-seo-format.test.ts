import { describe, expect, it } from "vitest";
import {
  parseAiJson,
  parseGeneratedImageAlt,
  parseGeneratedPostSeo,
} from "./ai-seo-format";

describe("формат ответов AI для SEO", () => {
  it("извлекает JSON из Markdown-обёртки", () => {
    expect(
      parseAiJson('```json\n{"title":"Волк-дурень","description":"Работа Алисы Гольневой о волке-дурне в живописной серии.","confidence":0.9}\n```'),
    ).toMatchObject({ title: "Волк-дурень", confidence: 0.9 });
  });

  it("принимает краткий естественный title и description", () => {
    expect(
      parseGeneratedPostSeo(
        JSON.stringify({
          title: "Волк-дурень — работа Алисы Гольневой",
          description:
            "Живописная работа Алисы Гольневой о волке-дурне, созданная как часть авторских набросков и наблюдений.",
          confidence: 0.86,
        }),
      ),
    ).toEqual({
      title: "Волк-дурень — работа Алисы Гольневой",
      description:
        "Живописная работа Алисы Гольневой о волке-дурне, созданная как часть авторских набросков и наблюдений.",
      confidence: 0.86,
    });
  });

  it("не пропускает слишком короткие или заспамленные SEO-значения", () => {
    expect(parseGeneratedPostSeo('{"title":"Волк","description":"Керамика керамика керамика керамика для всех."}')).toBeNull();
  });

  it("чистит alt от Markdown и эмодзи", () => {
    expect(
      parseGeneratedImageAlt('{"alt":"**Керамическая фигура волка** 🐺","confidence":0.8}'),
    ).toEqual({ alt: "Керамическая фигура волка", confidence: 0.8 });
  });
});
