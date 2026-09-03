import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderSettingsForm } from "./WanderSettingsForm";

const categories = [
  { id: "seen", name: "Увидела", isArchived: false, eligiblePostCount: 12 },
  { id: "drawn", name: "Нарисовала", isArchived: false, eligiblePostCount: 4 },
];

describe("настройки прогулки", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("по умолчанию включает категории и сохраняет только исключения", async () => {
    render(
      <WanderSettingsForm
        initialShowWanderEntry
        initialEntryLabel="не жми сюда"
        initialEntrySubtitle="серьёзно. неизвестно, куда попадёшь"
        initialImageCount={7}
        initialExcludedCategoryIds={[]}
        categories={categories}
      />,
    );
    const seen = screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" });
    expect(seen).toBeChecked();
    const count = screen.getByRole("spinbutton", { name: "Изображений до выставки" });
    expect(count).toHaveValue(7);
    expect(count).toHaveAttribute("min", "1");
    expect(count).toHaveAttribute("max", "100");
    fireEvent.change(count, { target: { value: "12" } });
    expect(screen.getByRole("textbox", { name: "Подпись под надписью" }))
      .toHaveValue("серьёзно. неизвестно, куда попадёшь");
    fireEvent.change(screen.getByRole("textbox", { name: "Надпись на главной" }), {
      target: { value: "не трогай" },
    });
    fireEvent.click(seen);
    fireEvent.change(screen.getByRole("textbox", { name: "Подпись под надписью" }), {
      target: { value: "посмотрим, что будет" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toEqual({
      showWanderEntry: true,
      entryLabel: "не трогай",
      entrySubtitle: "посмотрим, что будет",
      imageCount: 12,
      excludedCategoryIds: ["seen"],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Сохранено");
  });

  it("позволяет вернуть все категории одной кнопкой", () => {
    render(
      <WanderSettingsForm
        initialShowWanderEntry={false}
        initialEntryLabel="не жми сюда"
        initialEntrySubtitle="серьёзно. неизвестно, куда попадёшь"
        initialImageCount={12}
        initialExcludedCategoryIds={["seen"]}
        categories={categories}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Включить все" }));
    expect(screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" })).toBeChecked();
  });

  it.each(["", "0", "101", "2.5"])("не отправляет некорректное количество %s", (value) => {
    const view = render(<WanderSettingsForm initialShowWanderEntry initialEntryLabel="не жми сюда" initialEntrySubtitle="а вдруг" initialImageCount={7} initialExcludedCategoryIds={[]} categories={categories} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Изображений до выставки" }), { target: { value } });
    fireEvent.submit(view.container.querySelector("form")!);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Укажите целое число от 1 до 100");
  });
});
