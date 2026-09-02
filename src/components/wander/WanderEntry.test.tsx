import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderEntry } from "./WanderEntry";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  sessionStorage.clear();
  router.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("вход в режим", () => {
  it("показывает оба текста сразу и начинает новый маршрут без промежуточного вопроса", () => {
    sessionStorage.setItem("alice:wander:v1", "старый законченный маршрут");
    render(<WanderEntry label="не жми сюда" />);
    const entry = screen.getByRole("button", { name: "не жми сюда" });
    expect(entry).toHaveAccessibleDescription("серьёзно. неизвестно, куда попадёшь");
    expect(screen.getByText("серьёзно. неизвестно, куда попадёшь")).toBeVisible();
    fireEvent.click(entry);
    expect(entry).toBeDisabled();
    expect(screen.queryByText("точно?")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("alice:wander:v1")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/wander");
    fireEvent.click(entry);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("показывает редактируемое название обычным текстом", () => {
    render(<WanderEntry label="загляни сюда" subtitle="посмотрим, что будет" />);
    expect(screen.getByRole("button", { name: "загляни сюда" })).toHaveTextContent("загляни сюда");
    expect(screen.getByText("посмотрим, что будет")).toBeVisible();
  });

  it("подставляет стандартные тексты, если настройки пусты", () => {
    render(<WanderEntry label=" " subtitle=" " />);
    expect(screen.getByRole("button", { name: "не жми сюда" }))
      .toHaveAccessibleDescription("серьёзно. неизвестно, куда попадёшь");
  });

  it("открывает прогулку даже при недоступном хранилище", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<WanderEntry />);
    fireEvent.click(screen.getByRole("button", { name: "не жми сюда" }));
    expect(router.push).toHaveBeenCalledWith("/wander");
  });
});
