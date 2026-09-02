import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./SettingsForm";

const initial = {
  displayName: "Alice In Russialand",
  authorName: "Алиса Гольнева",
  tagline: "Иллюстрация и керамика",
  bio: "",
  aboutMarkdown: "",
  telegramChannelUser: "",
  contactsLabel: "Контакты",
  siteUrl: "http://localhost:3000",
  seoTitle: "",
  seoDescription: "",
  plausibleDomain: "",
  yandexMetrikaId: "",
  yandexVerification: "",
  defaultLocale: "ru",
  social: [],
  avatarPreviewUrl: null,
  aboutPhotoPreviewUrl: null,
};

describe("настройки сайта", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("сохраняет общие настройки без полей режима «не выбирай»", async () => {
    render(<SettingsForm initial={initial} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Имя / псевдоним" }), {
      target: { value: "Новое имя" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({ displayName: "Новое имя" });
    expect(body).not.toHaveProperty("showWanderEntry");
    expect(screen.queryByRole("checkbox", { name: /не выбирай/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Сохранено");
  });
});
