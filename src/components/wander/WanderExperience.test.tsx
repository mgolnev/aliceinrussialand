import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderExperience } from "./WanderExperience";
import { serializeWanderJourney, WANDER_STORAGE_KEY } from "@/lib/wander";
import { wanderFixture } from "@/test/wander-fixture";
import type { WanderCatalogue } from "@/lib/wander";

vi.mock("next/link", () => ({
  default: ({ href, prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => {
    void prefetch;
    return <a href={href} {...props} />;
  },
}));

function mount() {
  return render(<WanderExperience catalogue={wanderFixture()} initialStep={{ postId: "a", projectId: "portrait" }} />);
}
async function ready() {
  await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
  fireEvent.load(screen.getByRole("img"));
  await waitFor(() => expect(screen.getByRole("button", { name: "дальше" })).toBeEnabled());
}
async function loadCurrent() {
  await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
  fireEvent.load(screen.getByRole("img"));
}

function longWalkFixture(): WanderCatalogue {
  const projects = ["a", "b", "c"].map((id) => ({
    id, slug: id, title: `серия ${id}`, postIds: [] as string[],
  }));
  const posts = Array.from({ length: 9 }, (_, index) => {
    const project = projects[index % projects.length]!;
    const id = `long-${index}`;
    project.postIds.push(id);
    return {
      id, slug: id, title: `Работа ${index + 1}`,
      image: { src: `/${id}.webp`, thumbnail: `/${id}-small.webp`, alt: `Работа ${index + 1}`, width: 800, height: 1000 },
      projectIds: [project.id],
    };
  });
  return { posts, projects };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
});
afterEach(async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("интерфейс прогулки", () => {
  it("перед первой работой оставляет паузу и на мгновение говорит «это»", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    vi.useFakeTimers();
    mount();
    await act(async () => {});
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(180); });
    expect(screen.getByText("это")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(580); });
    expect(screen.getByRole("img")).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("показывает работу как отдельный режим без каталожного интерфейса", async () => {
    mount(); await ready();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText("Alice in Russialand")).not.toBeInTheDocument();
    expect(screen.queryByText("вся подборка")).not.toBeInTheDocument();
    expect(screen.queryByText("портрет")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "остаться" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "выйти" })).toHaveAttribute("href", "/");
  });
  it("завершает текущую сессию при выходе через крестик", async () => {
    mount(); await ready();
    expect(sessionStorage.getItem(WANDER_STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "выйти" }));
    expect(sessionStorage.getItem(WANDER_STORAGE_KEY)).toBeNull();
  });
  it("подстраивает ширину паспарту под пропорции каждой работы", async () => {
    mount(); await ready();
    const portraitWidth = screen.getByTestId("wander-artwork")
      .style.getPropertyValue("--frame-width");
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    await loadCurrent();
    const landscapeWidth = screen.getByTestId("wander-artwork")
      .style.getPropertyValue("--frame-width");
    expect(portraitWidth).not.toBe(landscapeWidth);
  });
  it("даёт остаться в мотиве, но не называет его до этого выбора", async () => {
    mount(); await ready();
    expect(screen.queryByText(/остаёмся в/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "остаться" }));
    await loadCurrent();
    expect(screen.getByText("остаёмся в портрет")).toBeInTheDocument();
  });
  it("проходит мост, сохраняет маршрут и возвращается из его просмотра", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    expect(screen.getByRole("status")).toHaveTextContent("Портрет ручкой");
    expect(screen.getByRole("button", { name: "дальше" })).toBeDisabled();
    await loadCurrent();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    await loadCurrent();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    expect(screen.getByRole("status")).toHaveTextContent("Волк-дурень");
    await loadCurrent();
    expect(JSON.parse(sessionStorage.getItem(WANDER_STORAGE_KEY)!).steps).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    expect(screen.getByText(/кажется,/)).toBeInTheDocument();
    expect(screen.getByRole("heading").textContent).toMatch(/вышли погулять/);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к работе 1: Первый портрет" }));
    expect(screen.getByRole("status")).toHaveTextContent("Работа 1");
    expect(screen.getByRole("button", { name: "хватит" })).toBeEnabled();
  });
  it("после конца можно начать новую прогулку", async () => {
    mount(); await ready();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "дальше" }));
      await loadCurrent();
    }
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    fireEvent.click(screen.getByRole("button", { name: "пройти ещё раз" }));
    await loadCurrent();
    expect(screen.getByRole("button", { name: "дальше" })).toBeEnabled();
  });
  it("возвращает сессию после открытия публикации или перезагрузки", async () => {
    sessionStorage.setItem(WANDER_STORAGE_KEY, serializeWanderJourney({
      steps: [{ postId: "b", projectId: "portrait" }, { postId: "c", projectId: "pen" }],
      viewedPostIds: ["b", "c"], cursor: 1, exhibitionSeenAt: 0,
    }));
    mount(); await ready();
    expect(screen.getByRole("status")).toHaveTextContent("Работа 2: Рисунок ручкой");
    expect(screen.queryByText("Подборка:")).not.toBeInTheDocument();
  });
  it("работает без доступа к sessionStorage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    expect(screen.getByRole("status")).toHaveTextContent("Портрет ручкой");
  });
  it("при ошибке картинки оставляет рабочие переходы", async () => {
    mount();
    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "дальше" })).toBeDisabled();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("изображение не загрузилось")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "пропустить" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "попробовать ещё раз ↻" })).toBeEnabled();
    expect(screen.queryByText("вся подборка")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "пропустить" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/b.webp");
    expect(JSON.parse(sessionStorage.getItem(WANDER_STORAGE_KEY)!).viewedPostIds).toEqual([]);
  });
  it("повторно загружает сломанное изображение и только потом засчитывает работу", async () => {
    mount();
    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    fireEvent.error(screen.getByRole("img"));
    fireEvent.click(screen.getByRole("button", { name: "попробовать ещё раз ↻" }));
    const retry = screen.getByRole("img");
    fireEvent.load(retry);
    expect(screen.getByRole("button", { name: "дальше" })).toBeEnabled();
    expect(screen.queryByText("вся подборка")).not.toBeInTheDocument();
  });
  it("после семи загруженных работ собирает выставку с названием", async () => {
    const catalogue = longWalkFixture();
    render(<WanderExperience catalogue={catalogue} initialStep={{ postId: "long-0", projectId: "a" }} />);
    await ready();
    for (let viewed = 1; viewed < 7; viewed++) {
      fireEvent.click(screen.getByRole("button", { name: "дальше" }));
      await loadCurrent();
    }
    expect(screen.getByRole("button", { name: "хватит" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    expect(screen.getByText(/кажется,/)).toBeInTheDocument();
    expect(screen.getByText(/выставка №\d{5} · 7 работ/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("heading").textContent).toMatch(/вышли погулять/);
    expect(screen.getByText(/^серия [abc] · серия [abc] · серия [abc]$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "пройти ещё раз" })).toBeEnabled();
  });
  it("для пустого каталога оставляет выход из режима", async () => {
    render(<WanderExperience catalogue={{ posts: [], projects: [] }} initialStep={null} />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "здесь пока пусто" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "дальше" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "выйти" })).toHaveAttribute("href", "/");
  });
});
