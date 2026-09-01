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
  showWanderEntry: true,
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

  it("отправляет состояние чекбокса «не выбирай» при сохранении", async () => {
    render(<SettingsForm initial={initial} />);
    const checkbox = screen.getByRole("checkbox", { name: /Показывать блок «не выбирай»/ });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({ showWanderEntry: false });
    expect(await screen.findByRole("status")).toHaveTextContent("Сохранено");
  });
});
