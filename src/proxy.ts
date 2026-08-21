import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  mergeResponseCookies,
  updateSupabaseSession,
} from "@/utils/supabase/proxy";
import { isSupabaseBrowserAuthConfigured } from "@/utils/supabase/env";
import { shouldAttemptSupabaseSessionRefresh } from "@/lib/proxy-session-policy";
import { getLegacyPublicRedirect } from "@/lib/legacy-public-redirects";

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Анонимные RSC/HTML-страницы можно безопасно отдать из общего CDN-кеша. */
function isCacheablePublicDocument(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const { pathname } = request.nextUrl;
  return (
    !request.cookies.has(SESSION_COOKIE_NAME) &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyDestination = getLegacyPublicRedirect(pathname);
  if (legacyDestination) {
    const destination = request.nextUrl.clone();
    destination.pathname = legacyDestination;
    return NextResponse.redirect(destination, 301);
  }

  const cookieNames = request.cookies.getAll().map((c) => c.name);
  const sessionResponse =
    shouldAttemptSupabaseSessionRefresh(
      pathname,
      cookieNames,
      isSupabaseBrowserAuthConfigured(),
    )
      ? await updateSupabaseSession(request)
      : NextResponse.next({ request });

  if (pathname.startsWith("/admin/login")) {
    return sessionResponse;
  }

  /** Сразу на ленту, без кадра с оболочкой админки */
  if (pathname === "/admin" && (await isAdmin(request))) {
    const home = NextResponse.redirect(new URL("/", request.url));
    return mergeResponseCookies(sessionResponse, home);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!(await isAdmin(request))) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Нужна авторизация" },
          { status: 401 },
        );
      }
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("from", pathname);
      const redirect = NextResponse.redirect(login);
      return mergeResponseCookies(sessionResponse, redirect);
    }
  }

  // Amvera/CDN может хранить HTML, а Next параллельно обновляет данные через
  // revalidateTag/revalidatePath после публикации. Не кэшируем ответ с cookie.
  if (
    isCacheablePublicDocument(request) &&
    !sessionResponse.headers.has("set-cookie")
  ) {
    sessionResponse.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
    );
  } else if (request.cookies.has(SESSION_COOKIE_NAME)) {
    // Авторский экран может содержать кнопки управления — его нельзя отдать
    // из общего CDN-кеша даже при случайно недействительном токене.
    sessionResponse.headers.set("Cache-Control", "private, no-store");
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Как раньше: весь документный трафик; дорогой вызов Supabase делаем только по policy внутри proxy.
     */
      "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
