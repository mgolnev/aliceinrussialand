import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WanderExperience } from "./WanderExperience";
import { serializeWanderJourney, WANDER_RECENT_IMAGES_KEY, WANDER_STORAGE_KEY } from "@/lib/wander";
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
  return render(<WanderExperience catalogue={wanderFixture()} initialStep={{ postId: "a", projectId: "portrait", imageId: "a-1" }} />);
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
      images: [{ id: `${id}-1`, src: `/${id}.webp`, thumbnail: `/${id}-small.webp`, alt: `Работа ${index + 1}`, width: 800, height: 1000 }],
      projectIds: [project.id],
    };
  });
  return { posts, projects };
}
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
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
  it("показывает работу как отдельный режим без каталожного интерфейса", async () => {
    mount(); await ready();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText("Alice in Russialand")).not.toBeInTheDocument();
    expect(screen.queryByText("вся подборка")).not.toBeInTheDocument();
    expect(screen.queryByText("портрет")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "остаться" })).not.toBeInTheDocument();
    expect(screen.queryByText("это")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "выйти" })).toHaveAttribute("href", "/");
  });
  it("показывает самостоятельную публикацию без подборки", async () => {
    const catalogue: WanderCatalogue = {
      posts: [{
        id: "solo", slug: "solo", title: "Самостоятельная работа", projectIds: [],
        images: [{ id: "solo-1", src: "/solo.webp", thumbnail: "/solo-small.webp", alt: "Самостоятельная работа", width: 800, height: 1000 }],
      }],
      projects: [],
    };
    render(<WanderExperience catalogue={catalogue} initialStep={{ postId: "solo", imageId: "solo-1" }} />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Самостоятельная работа" })).toBeInTheDocument());
    fireEvent.load(screen.getByRole("img"));
    expect(screen.getByRole("button", { name: "хватит" })).toBeEnabled();
  });
  it("завершает текущую сессию при выходе через крестик", async () => {
    mount(); await ready();
    expect(sessionStorage.getItem(WANDER_STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "выйти" }));
    expect(sessionStorage.getItem(WANDER_STORAGE_KEY)).toBeNull();
  });
  it("подстраивает ширину паспарту под пропорции каждой работы", async () => {
    const catalogue: WanderCatalogue = {
      posts: [
        { id: "portrait", slug: "portrait", title: "Портрет", images: [{ id: "portrait-1", src: "/portrait.webp", thumbnail: "/portrait-small.webp", alt: "Портрет", width: 800, height: 1000 }], projectIds: ["shape"] },
        { id: "landscape", slug: "landscape", title: "Пейзаж", images: [{ id: "landscape-1", src: "/landscape.webp", thumbnail: "/landscape-small.webp", alt: "Пейзаж", width: 1200, height: 800 }], projectIds: ["shape"] },
      ],
      projects: [{ id: "shape", slug: "shape", title: "форма", postIds: ["portrait", "landscape"] }],
    };
    render(<WanderExperience catalogue={catalogue} initialStep={{ postId: "portrait", projectId: "shape", imageId: "portrait-1" }} />);
    await ready();
    const portraitWidth = screen.getByTestId("wander-artwork")
      .style.getPropertyValue("--frame-width");
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    await loadCurrent();
    const landscapeWidth = screen.getByTestId("wander-artwork")
      .style.getPropertyValue("--frame-width");
    expect(portraitWidth).not.toBe(landscapeWidth);
  });
  it("держит место под работу скелетоном до загрузки изображения", async () => {
    mount();
    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(screen.getByTestId("wander-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "дальше" })).toBeDisabled();
    fireEvent.load(screen.getByRole("img"));
    expect(screen.queryByTestId("wander-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "дальше" })).toBeEnabled();
  });
  it("сохраняет контрастный маршрут и возвращается из его просмотра", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    expect(screen.getByRole("button", { name: "дальше" })).toBeDisabled();
    await loadCurrent();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    await loadCurrent();
    fireEvent.click(screen.getByRole("button", { name: "дальше" }));
    await loadCurrent();
    expect(JSON.parse(sessionStorage.getItem(WANDER_STORAGE_KEY)!).steps).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    expect(screen.getByText(/кажется,/)).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent(/кажется,/);
    expect(screen.queryByText(/вышли погулять/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Открыть публикацию 1: Первый портрет" }))
      .toHaveAttribute("href", "/p/portret");
    fireEvent.click(screen.getByRole("button", { name: "вернуться к работе" }));
    expect(screen.getByRole("status")).toHaveTextContent("Работа 4");
    expect(screen.getByRole("button", { name: "хватит" })).toBeEnabled();
  });
  it("после конца можно начать новую прогулку", async () => {
    mount(); await ready();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "дальше" }));
      await loadCurrent();
    }
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "пройти ещё раз" })).toBeEnabled());
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "пройти ещё раз" }));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    const nextButton = screen.getByRole("button", { name: "дальше" });
    expect(nextButton).toBeVisible();
    expect(nextButton).toBeDisabled();
    expect(screen.getByText("дальше", { selector: "span" })).toBeVisible();
    expect(screen.getByTestId("wander-skeleton")).toBeInTheDocument();
    await loadCurrent();
    expect(screen.getByRole("button", { name: "дальше" })).toBeEnabled();
  });
  it("в повторной прогулке не показывает только что просмотренную обложку", async () => {
    const catalogue: WanderCatalogue = {
      posts: [{
        id: "comic", slug: "comic", title: "Комикс", projectIds: ["comic"],
        images: [
          { id: "comic-cover", src: "/comic-cover.webp", thumbnail: "/comic-cover-small.webp", alt: "Обложка", width: 800, height: 1000 },
          { id: "comic-page", src: "/comic-page.webp", thumbnail: "/comic-page-small.webp", alt: "Страница комикса", width: 800, height: 1000 },
        ],
      }],
      projects: [{ id: "comic", slug: "comic", title: "комикс", postIds: ["comic"] }],
    };
    render(<WanderExperience catalogue={catalogue} initialStep={{ postId: "comic", projectId: "comic", imageId: "comic-cover" }} />);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "/comic-cover.webp"));
    fireEvent.load(screen.getByRole("img"));
    expect(JSON.parse(localStorage.getItem(WANDER_RECENT_IMAGES_KEY)!)).toEqual(["comic-cover"]);
    fireEvent.click(screen.getByRole("button", { name: "хватит" }));
    fireEvent.click(screen.getByRole("button", { name: "пройти ещё раз" }));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "/comic-page.webp"));
  });
  it("возвращает сессию после открытия публикации или перезагрузки", async () => {
    sessionStorage.setItem(WANDER_STORAGE_KEY, serializeWanderJourney({
      steps: [{ postId: "b", projectId: "portrait", imageId: "b-1" }, { postId: "c", projectId: "pen", imageId: "c-1" }],
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
    expect(screen.getByRole("status")).toHaveTextContent("Работа 2");
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
    expect(screen.getByRole("img")).not.toHaveAttribute("src", "/a.webp");
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
    render(<WanderExperience catalogue={catalogue} initialStep={{ postId: "long-0", projectId: "a", imageId: "long-0-1" }} />);
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
    expect(screen.getAllByRole("link", { name: /Открыть публикацию/ })).toHaveLength(7);
    expect(screen.getByRole("button", { name: "вернуться к работе" })).toBeEnabled();
    expect(screen.getByRole("heading")).toHaveTextContent(/кажется,/);
    expect(screen.queryByText(/вышли погулять/)).not.toBeInTheDocument();
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
