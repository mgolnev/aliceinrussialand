import { NextResponse } from "next/server";
import { getSocialImportProvider } from "@/lib/social-import/providers";
import type { SocialPlatform } from "@/lib/social-import/types";
import {
  listAlreadyImportedSourceUrls,
} from "@/lib/social-import/import-core";

export const runtime = "nodejs";
export const maxDuration = 45;

function parsePlatform(v: unknown): SocialPlatform | null {
  if (v === "instagram" || v === "behance") return v;
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    platform?: unknown;
    account?: string;
    limit?: number;
    before?: string | null;
  } | null;

  const platform = parsePlatform(body?.platform);
  if (!platform) {
    return NextResponse.json(
      { error: "Укажите platform: instagram | behance" },
      { status: 400 },
    );
  }

  const account = body?.account?.trim() ?? "";
  if (!account) {
    return NextResponse.json(
      { error: "Укажите account (username)" },
      { status: 400 },
    );
  }

  const provider = getSocialImportProvider(platform);
  try {
    const page = await provider.preview({
      account,
      limit: Math.min(Math.max(body?.limit ?? 20, 1), 40),
      cursor: body?.before ?? null,
    });

    const importedSourceUrls = await listAlreadyImportedSourceUrls(
      platform,
      page.items.map((i) => i.href).filter(Boolean),
    );

    return NextResponse.json({
      platform,
      account,
      items: page.items,
      nextCursor: page.nextCursor,
      importedSourceUrls,
    });
  } catch (e) {
    const msg = "Ошибка загрузки списка соцсети.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
