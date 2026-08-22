import { afterEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({
  createSessionToken: vi.fn(async () => "test-session-token"),
  SESSION_COOKIE_NAME: "alice_session",
}));

function formRequest(password: string, from = "/admin") {
  return new Request("http://0.0.0.0:3000/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-host": "aliceinrussialand.ru:3000",
      "x-forwarded-proto": "https",
    },
    body: new URLSearchParams({ password, from }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin login redirects", () => {
  it("does not expose Amvera's internal port after an invalid password", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://aliceinrussialand.ru");
    vi.stubEnv("ADMIN_PASSWORD_HASH", await bcrypt.hash("correct-password", 4));

    const response = await POST(formRequest("wrong-password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://aliceinrussialand.ru/admin/login?from=%2Fadmin&error=invalid_password",
    );
  });

  it("sets the session cookie and redirects a valid login to the public origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://aliceinrussialand.ru");
    vi.stubEnv("ADMIN_PASSWORD_HASH", await bcrypt.hash("correct-password", 4));
    vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-16-chars");

    const response = await POST(formRequest("correct-password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://aliceinrussialand.ru/admin",
    );
    expect(response.headers.get("set-cookie")).toContain("alice_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
