import fs from "node:fs/promises";
import path from "node:path";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { parseGeneratedImageAlt, parseGeneratedPostSeo } from "@/lib/ai-seo-format";
import { parseVariants } from "@/lib/posts-query";
import { pickDefaultVariantUrl } from "@/lib/image-variants";
import { richTextToPlainText } from "@/lib/rich-text";
import { stripEmojiForSeo } from "@/lib/seo-sanitize";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;

let proxyDispatcher: ProxyAgent | undefined;

export class AiSeoProviderError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION" | "NETWORK" | "RESPONSE",
  ) {
    super(message);
    this.name = "AiSeoProviderError";
  }
}

export type AiSeoPostInput = {
  authorName: string;
  title: string;
  body: string;
  categoryName: string | null;
  projectTitles: string[];
};

export type AiSeoImageInput = AiSeoPostInput & {
  caption: string;
  variantsJson: string;
};

function outboundProxyUrl(): string | undefined {
  const value =
    process.env.OPENROUTER_OUTBOUND_PROXY?.trim() ||
    // Если уже используется единый прокси для Telegram, OpenRouter сможет
    // использовать его без второй настройки.
    process.env.TELEGRAM_OUTBOUND_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  return value || undefined;
}

function getDispatcher(): ProxyAgent | undefined {
  const proxyUrl = outboundProxyUrl();
  if (!proxyUrl) return undefined;
  if (!proxyDispatcher) proxyDispatcher = new ProxyAgent(proxyUrl);
  return proxyDispatcher;
}

function currentModel(): string {
  return process.env.OPENROUTER_SEO_MODEL?.trim() || "openai/gpt-5.6-luna";
}

function completionTokenBudget(requested: number): number {
  // Gemini 3.7 Flash обязательно тратит часть лимита на внутреннее рассуждение.
  // При коротком лимите ответ может оборваться до JSON с alt или SEO-текстом.
  return currentModel().startsWith("google/gemini-3.7-")
    ? Math.max(requested, 1_000)
    : requested;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .join("\n");
}

async function askOpenRouter(
  content: Array<Record<string, unknown>>,
  maxTokens: number,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new AiSeoProviderError(
      "OPENROUTER_API_KEY не настроен",
      "CONFIGURATION",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const dispatcher = getDispatcher();
    const response = await undiciFetch(
      OPENROUTER_URL,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://aliceinrussialand.ru",
          "X-Title": "Alice In Russialand SEO",
        },
        body: JSON.stringify({
          model: currentModel(),
          temperature: 0.2,
          max_tokens: completionTokenBudget(maxTokens),
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Ты аккуратный русскоязычный редактор портфолио художника. Не выдумывай факты, не используй SEO-спам, не добавляй эмодзи. Отвечай только JSON-объектом по заданной схеме.",
            },
            { role: "user", content },
          ],
        }),
        ...(dispatcher ? { dispatcher } : {}),
      } as Parameters<typeof undiciFetch>[1],
    );
    if (!response.ok) {
      throw new AiSeoProviderError(
        `OpenRouter вернул HTTP ${response.status}`,
        "RESPONSE",
      );
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const raw = textContent(data.choices?.[0]?.message?.content);
    if (!raw) {
      throw new AiSeoProviderError("OpenRouter не вернул текст", "RESPONSE");
    }
    return raw;
  } catch (error) {
    if (error instanceof AiSeoProviderError) throw error;
    const message = error instanceof Error && error.name === "AbortError"
      ? "Таймаут OpenRouter"
      : "Не удалось обратиться к OpenRouter";
    throw new AiSeoProviderError(message, "NETWORK");
  } finally {
    clearTimeout(timer);
  }
}

function compactPostText(body: string, limit = 6_000): string {
  const plain = stripEmojiForSeo(richTextToPlainText(body));
  return plain.length <= limit ? plain : `${plain.slice(0, limit)}…`;
}

function postContext(input: AiSeoPostInput): string {
  const projects = input.projectTitles.filter(Boolean).join(", ") || "нет";
  return [
    `Автор: ${input.authorName || "Алиса Гольнева"}`,
    `Первая строка импорта: ${input.title || "нет"} (это техническая подсказка, а не готовое название)`,
    `Тема: ${input.categoryName || "не указана"}`,
    `Подборки: ${projects}`,
    `Текст публикации: ${compactPostText(input.body) || "нет текста"}`,
  ].join("\n");
}

export async function generatePostSeo(input: AiSeoPostInput) {
  const raw = await askOpenRouter(
    [
      {
        type: "text",
        text:
          "Составь естественные SEO title и description для отдельной публикации художника. Первая строка импорта часто совпадает с началом текста Telegram, бывает пустой или длинной и НЕ является готовым заголовком: не копируй её в title. Самостоятельно определи тему по тексту публикации, теме и подборкам. Если в тексте есть точное название работы, сохрани его. Title: 20–70 символов, в конце естественно укажи полное имя автора из поля «Автор», например «… — Алиса Гольнева». Description: 45–180 символов, кратко объясняет содержание публикации; имя автора добавляй только если оно звучит естественно. Не перечисляй ключевые слова и не обещай того, чего нет. Верни JSON: {\"title\": string, \"description\": string, \"confidence\": number}.\n\n" +
          postContext(input),
      },
    ],
    320,
  );
  return parseGeneratedPostSeo(raw);
}

async function imageForVision(variantsJson: string): Promise<string | null> {
  const variant = pickDefaultVariantUrl(parseVariants(variantsJson));
  if (!variant) return null;
  if (/^https:\/\//i.test(variant)) return variant;
  if (!variant.startsWith("/media/")) return null;

  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, `.${variant}`);
  const relative = path.relative(publicRoot, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;

  try {
    const data = await fs.readFile(filePath);
    return `data:image/webp;base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function generateImageAlt(input: AiSeoImageInput) {
  const imageUrl = await imageForVision(input.variantsJson);
  if (!imageUrl) return null;
  const raw = await askOpenRouter(
    [
      {
        type: "text",
        text:
          "Напиши короткий, естественный alt на русском для одной работы в портфолио. Это текст для человека, который не видит работу, и для поиска изображений. Если заголовок — точное название произведения и помогает отличить работу, естественно включи его в конструкцию «Работа „название“: главный мотив». Затем назови только один-два главных мотива композиции. Не перечисляй мелкие детали, цвета или предметы без необходимости, не используй расплывчатые слова вроде «стилизованный», не начинай со слов «изображение», «фото» или «картинка» и не добавляй ключевые слова ради поиска. Описывай только то, что видно; не выдумывай технику, сюжет или смысл. Длина 5–160 символов. Верни JSON: {\"alt\": string, \"confidence\": number}.\n\n" +
          postContext(input) +
          `\nПодпись автора: ${input.caption || "нет"}`,
      },
      { type: "image_url", image_url: { url: imageUrl } },
    ],
    180,
  );
  return parseGeneratedImageAlt(raw);
}
