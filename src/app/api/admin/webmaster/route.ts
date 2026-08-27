import { NextResponse } from "next/server";
import { isIndexNowConfigured } from "@/lib/indexnow";
import {
  buildWebmasterSnapshot,
  canonicalUrlKey,
  disconnectedWebmasterSnapshot,
  listSearchCandidates,
} from "@/lib/yandex-webmaster-monitor";
import {
  isYandexWebmasterConfigured,
  YandexWebmasterApiError,
  YandexWebmasterClient,
} from "@/lib/yandex-webmaster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function apiError(error: unknown) {
  if (error instanceof YandexWebmasterApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
    );
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Ошибка Яндекс Вебмастера" },
    { status: 502 },
  );
}

export async function GET() {
  try {
    const candidates = await listSearchCandidates();
    const indexNowConfigured = isIndexNowConfigured();
    if (!isYandexWebmasterConfigured()) {
      return NextResponse.json(
        disconnectedWebmasterSnapshot({
          siteUrl: candidates.siteUrl,
          candidates: candidates.items,
          indexNowConfigured,
        }),
      );
    }
    const client = await YandexWebmasterClient.connect(candidates.siteUrl);
    const data = await client.getData();
    return NextResponse.json(
      buildWebmasterSnapshot({
        candidates: candidates.items,
        data,
        siteUrl: candidates.siteUrl,
        indexNowConfigured,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      urls?: unknown;
    } | null;
    if (!body || !Array.isArray(body.urls)) {
      return NextResponse.json(
        { error: "Передайте список URL" },
        { status: 400 },
      );
    }
    const requested = body.urls.filter(
      (value): value is string => typeof value === "string",
    );
    if (!requested.length || requested.length > 150) {
      return NextResponse.json(
        { error: "Можно отправить от 1 до 150 страниц" },
        { status: 400 },
      );
    }

    const candidates = await listSearchCandidates();
    const allowed = new Map(
      candidates.items.flatMap((item) => {
        const key = canonicalUrlKey(item.url);
        return key ? [[key, item.url] as const] : [];
      }),
    );
    const requestedKeys = requested.map(canonicalUrlKey);
    if (requestedKeys.some((key) => !key || !allowed.has(key))) {
      return NextResponse.json(
        { error: "В списке есть URL, которого нет среди опубликованных страниц" },
        { status: 400 },
      );
    }
    const urls = [...new Set(requestedKeys)].map(
      (key) => allowed.get(key as string) as string,
    );

    const client = await YandexWebmasterClient.connect(candidates.siteUrl);
    const quota = await client.getQuota();
    if (!quota.quota_remainder) {
      return NextResponse.json(
        { error: "Суточная квота переобхода исчерпана", quota },
        { status: 429 },
      );
    }
    const accepted: string[] = [];
    const alreadyQueued: string[] = [];
    const failed: Array<{ url: string; error: string }> = [];
    let remaining = quota.quota_remainder;

    for (const url of urls) {
      if (!remaining) break;
      try {
        const result = await client.submitRecrawl(url);
        accepted.push(url);
        remaining = result.quotaRemainder;
      } catch (error) {
        if (
          error instanceof YandexWebmasterApiError &&
          error.code === "URL_ALREADY_ADDED"
        ) {
          alreadyQueued.push(url);
          continue;
        }
        if (
          error instanceof YandexWebmasterApiError &&
          error.code === "QUOTA_EXCEEDED"
        ) {
          remaining = 0;
          break;
        }
        failed.push({
          url,
          error: error instanceof Error ? error.message : "Ошибка отправки",
        });
      }
    }

    return NextResponse.json({
      accepted,
      alreadyQueued,
      failed,
      quota: { daily: quota.daily_quota, remainder: remaining },
    });
  } catch (error) {
    return apiError(error);
  }
}
