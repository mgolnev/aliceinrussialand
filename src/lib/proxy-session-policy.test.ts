import { describe, expect, it } from "vitest";
import { shouldAttemptSupabaseSessionRefresh } from "./proxy-session-policy";

describe("shouldAttemptSupabaseSessionRefresh", () => {
  it("не вызывать при выключенном Supabase", () => {
    expect(
      shouldAttemptSupabaseSessionRefresh("/about", [], false),
    ).toBe(false);
  });

  it("админка — да", () => {
    expect(
      shouldAttemptSupabaseSessionRefresh("/admin/posts", [], true),
    ).toBe(true);
  });

  it("api admin — да", () => {
    expect(
      shouldAttemptSupabaseSessionRefresh("/api/admin/posts", [], true),
    ).toBe(true);
  });

  it("api auth — да", () => {
    expect(
      shouldAttemptSupabaseSessionRefresh("/api/auth/callback", [], true),
    ).toBe(true);
  });

  it("публичная страница без sb-кук — нет", () => {
    expect(shouldAttemptSupabaseSessionRefresh("/", [], true)).toBe(false);
  });

  it("публичная страница с sb-кукой — да", () => {
    expect(
      shouldAttemptSupabaseSessionRefresh("/", ["sb-xxx-auth-token"], true),
    ).toBe(true);
  });
});
