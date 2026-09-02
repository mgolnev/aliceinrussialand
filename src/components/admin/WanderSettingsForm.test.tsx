import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderSettingsForm } from "./WanderSettingsForm";

const categories = [
  { id: "seen", name: "Увидела", isArchived: false, eligiblePostCount: 12 },
  { id: "drawn", name: "Нарисовала", isArchived: false, eligiblePostCount: 4 },
];

describe("настройки «не выбирай»", () => {
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
        initialExcludedCategoryIds={[]}
        categories={categories}
      />,
    );
    const seen = screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" });
    expect(seen).toBeChecked();
    fireEvent.click(seen);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toEqual({
      showWanderEntry: true,
      excludedCategoryIds: ["seen"],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Сохранено");
  });

  it("позволяет вернуть все категории одной кнопкой", () => {
    render(
      <WanderSettingsForm
        initialShowWanderEntry={false}
        initialExcludedCategoryIds={["seen"]}
        categories={categories}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Включить все" }));
    expect(screen.getByRole("checkbox", { name: "Показывать категорию «Увидела»" })).toBeChecked();
  });
});
