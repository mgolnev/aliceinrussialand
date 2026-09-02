import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderEntry } from "./WanderEntry";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  sessionStorage.clear();
  router.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("вход в режим", () => {
  it("сначала спрашивает, а затем проваливается в прогулку", () => {
    sessionStorage.setItem("alice:wander:v1", "старый законченный маршрут");
    render(<WanderEntry label="не жми сюда" />);
    const entry = screen.getByRole("button", { name: "не жми сюда" });
    expect(entry).toHaveAttribute("data-paper", "grid");
    expect(entry).toHaveAttribute("data-author-handwriting", "true");
    fireEvent.click(entry);
    const confirmation = screen.getByRole("button", { name: "точно?" });
    expect(confirmation).toBeDisabled();
    expect(confirmation).toHaveAttribute("data-paper", "lined");
    expect(sessionStorage.getItem("alice:wander:v1")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(560));
    expect(router.push).toHaveBeenCalledWith("/wander");
  });

  it("оставляет редактируемый текст шрифтовым", () => {
    render(<WanderEntry label="загляни сюда" />);
    expect(screen.getByRole("button", { name: "загляни сюда" }))
      .toHaveAttribute("data-author-handwriting", "false");
  });
});
