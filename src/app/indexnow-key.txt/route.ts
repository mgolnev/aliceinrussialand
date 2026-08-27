import { getIndexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const key = getIndexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(`${key}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
