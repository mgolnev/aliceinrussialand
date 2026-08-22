import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { resolveSiteOrigin } from "@/lib/site-origin";

function isFormSubmission(req: Request) {
  return req.headers
    .get("content-type")
    ?.includes("application/x-www-form-urlencoded");
}

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function requestUrl(req: Request, pathname: string) {
  // Reverse proxies may expose the container's internal :3000 port through
  // Request.url/x-forwarded-host. Production redirects must use the configured
  // public origin, otherwise the browser is sent to an unreachable port.
  if (process.env.NODE_ENV === "production") {
    return new URL(pathname, `${resolveSiteOrigin()}/`);
  }

  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? req.headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  const forwardedProtocol = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  // В `next dev` Request.url может содержать localhost даже при входе с телефона
  // по локальному IP. Берём исходный Host, чтобы после POST не увести телефон
  // на его собственный localhost.
  if (host) url.host = host;
  if (forwardedProtocol) url.protocol = `${forwardedProtocol}:`;
  url.pathname = pathname;
  url.search = "";
  return url;
}

function loginRedirect(req: Request, from: string, error?: string) {
  const url = requestUrl(req, "/admin/login");
  if (from !== "/") url.searchParams.set("from", from);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const submittedAsForm = isFormSubmission(req);
  const body = submittedAsForm
    ? await req.formData().catch(() => null)
    : ((await req.json().catch(() => null)) as { password?: string } | null);
  const form = submittedAsForm ? (body as FormData | null) : null;
  const json = submittedAsForm
    ? null
    : (body as { password?: string } | null);
  const password = form
    ? String(form.get("password") ?? "")
    : json?.password ?? "";
  const from = safeReturnPath(form ? String(form.get("from") ?? "") : null);
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    if (submittedAsForm) return loginRedirect(req, from, "server_error");
    return NextResponse.json(
      { error: "ADMIN_PASSWORD_HASH не задан в .env" },
      { status: 500 },
    );
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    if (submittedAsForm) return loginRedirect(req, from, "invalid_password");
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = submittedAsForm
    ? NextResponse.redirect(requestUrl(req, from), 303)
    : NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
