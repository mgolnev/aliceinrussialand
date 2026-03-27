import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    password?: string;
  } | null;
  const password = body?.password ?? "";
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD_HASH не задан в .env" },
      { status: 500 },
    );
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
