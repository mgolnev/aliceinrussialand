import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { downloadSocialImage } from "@/lib/social-import/fetch";
import { importSocialItems } from "@/lib/social-import/import-core";
import type { SocialImportItem, SocialPlatform } from "@/lib/social-import/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function parsePlatform(v: unknown): SocialPlatform | null {
  if (v === "instagram" || v === "behance") return v;
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: unknown;
      items?: SocialImportItem[];
      publish?: boolean;
    } | null;
    const platform = parsePlatform(body?.platform);
    if (!platform) {
      return NextResponse.json(
        { error: "Укажите platform: instagram | behance" },
        { status: 400 },
      );
    }
    if (!body?.items?.length) {
      return NextResponse.json({ error: "Пустой список" }, { status: 400 });
    }

    const result = await importSocialItems({
      platform,
      items: body.items,
      publish: Boolean(body.publish),
      downloadImage: downloadSocialImage,
    });
    revalidatePath("/admin/posts");
    return NextResponse.json(result);
  } catch (error) {
    const message = "Не удалось импортировать посты соцсети.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
