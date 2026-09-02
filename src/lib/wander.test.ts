import { describe, expect, it } from "vitest";
import {
  nextWanderStep,
  pickWanderImage,
  rememberWanderImage,
  restoreWanderRecentImages,
  restoreWanderJourney,
  serializeWanderJourney,
  wanderExhibitionNumber,
  wanderExhibitionTags,
  wanderExhibitionTitle,
  type WanderStep,
} from "./wander";
import { wanderFixture } from "@/test/wander-fixture";

describe("прогулка по подборкам", () => {
  it("первым выбирает подборку, а не взвешивает её по количеству работ", () => {
    expect(nextWanderStep(wanderFixture(), [], undefined, () => .99)).toEqual({ postId: "d", projectId: "wolf", imageId: "d-1" });
  });
  it("сразу выходит из текущей подборки, если есть другой путь", () => {
    const start = { postId: "a", projectId: "portrait" };
    expect(nextWanderStep(wanderFixture(), [start], start, () => 0)).toEqual({ postId: "b", projectId: "pen", imageId: "b-1" });
  });
  it("предпочитает явную смену формата варианту с неизвестной геометрией", () => {
    const bridge = { postId: "b", projectId: "portrait" };
    expect(nextWanderStep(wanderFixture(), [bridge], bridge, () => 0)).toEqual({ postId: "c", projectId: "pen", imageId: "c-1" });
  });
  it("в тупике выбирает другую непосмотренную работу", () => {
    const visited = [{ postId: "b", projectId: "portrait" }, { postId: "c", projectId: "pen" }];
    expect(nextWanderStep(wanderFixture(), visited, visited[1], () => .99)).toEqual({ postId: "d", projectId: "wolf", imageId: "d-1" });
  });
  it("обходит весь каталог без повторов и завершает прогулку", () => {
    const visited: WanderStep[] = [];
    for (let i = 0; i < 10; i++) {
      const step = nextWanderStep(wanderFixture(), visited, visited.at(-1), () => .4);
      if (!step) break;
      visited.push(step);
    }
    expect(visited).toHaveLength(4);
    expect(new Set(visited.map((step) => step.postId)).size).toBe(4);
    expect(nextWanderStep(wanderFixture(), visited)).toBeNull();
  });
  it("не повторяет уже увиденное при продолжении с более раннего шага", () => {
    const visited = [{ postId: "a", projectId: "portrait" }, { postId: "b", projectId: "portrait" }, { postId: "c", projectId: "pen" }];
    expect(nextWanderStep(wanderFixture(), visited, visited[0])?.postId).toBe("d");
  });
  it("спокойно обрабатывает пустой каталог", () => {
    expect(nextWanderStep({ posts: [], projects: [] }, [])).toBeNull();
  });
  it("проходит самостоятельные публикации без фиктивной подборки", () => {
    const catalogue = {
      posts: [
        { id: "solo-a", slug: "solo-a", title: "Один", images: [{ id: "solo-a-1", src: "/solo-a.webp", thumbnail: "/solo-a-small.webp", alt: "Один", width: 800, height: 1000 }], projectIds: [] },
        { id: "solo-b", slug: "solo-b", title: "Два", images: [{ id: "solo-b-1", src: "/solo-b.webp", thumbnail: "/solo-b-small.webp", alt: "Два", width: 1200, height: 800 }], projectIds: [] },
      ],
      projects: [],
    };
    const first = nextWanderStep(catalogue, [], undefined, () => 0);
    expect(first).toEqual({ postId: "solo-a", imageId: "solo-a-1" });
    expect(nextWanderStep(catalogue, [first!], first!, () => 0)).toEqual({ postId: "solo-b", imageId: "solo-b-1" });
  });
  it("не выбирает тот же формат, пока доступен противоположный", () => {
    const catalogue = {
      posts: [
        { id: "start", slug: "start", title: "Старт", images: [{ id: "start-1", src: "/start.webp", thumbnail: "/start-small.webp", alt: "Старт", width: 800, height: 1200 }], projectIds: [] },
        { id: "same", slug: "same", title: "Та же форма", images: [{ id: "same-1", src: "/same.webp", thumbnail: "/same-small.webp", alt: "Та же форма", width: 800, height: 1200 }], projectIds: [] },
        { id: "opposite", slug: "opposite", title: "Другая форма", images: [{ id: "opposite-1", src: "/opposite.webp", thumbnail: "/opposite-small.webp", alt: "Другая форма", width: 1200, height: 800 }], projectIds: [] },
      ],
      projects: [],
    };
    const start = { postId: "start", imageId: "start-1" };
    expect(nextWanderStep(catalogue, [start], start, () => .99)?.postId).toBe("opposite");
  });
  it("не остаётся в одной серии даже на второй шаг, пока есть альтернатива", () => {
    const fixture = wanderFixture();
    const first = { postId: "a", projectId: "portrait" };
    const second = { postId: "b", projectId: "portrait" };
    const next = nextWanderStep(fixture, [first, second], second, () => .99);
    expect(next?.projectId).not.toBe("portrait");
  });
  it("оставляет хаосу выбор между равно контрастными работами", () => {
    const fixture: Parameters<typeof nextWanderStep>[0] = {
      posts: [
        { id: "a", slug: "a", title: "Портрет", images: [{ id: "a-1", src: "/a.webp", thumbnail: "/a-small.webp", alt: "Портрет", width: 800, height: 1000 }], projectIds: ["portrait"] },
        { id: "x", slug: "x", title: "Поле", images: [{ id: "x-1", src: "/x.webp", thumbnail: "/x-small.webp", alt: "Поле", width: 1200, height: 800 }], projectIds: ["outside"] },
        { id: "y", slug: "y", title: "Река", images: [{ id: "y-1", src: "/y.webp", thumbnail: "/y-small.webp", alt: "Река", width: 1200, height: 800 }], projectIds: ["outside"] },
      ],
      projects: [
        { id: "portrait", slug: "portrait", title: "портрет", postIds: ["a"] },
        { id: "outside", slug: "outside", title: "снаружи", postIds: ["x", "y"] },
      ],
    };
    const start = { postId: "a", projectId: "portrait", imageId: "a-1" };
    expect(nextWanderStep(fixture, [start], start, () => 0)?.postId).toBe("x");
    expect(nextWanderStep(fixture, [start], start, () => .99)?.postId).toBe("y");
  });
  it("учитывает историю предыдущего запуска и не начинает с той же серии", () => {
    const next = nextWanderStep(wanderFixture(), [], undefined, () => 0, ["a-1"]);
    expect(next?.postId).not.toBe("a");
    expect(next?.projectId).not.toBe("portrait");
  });
});

describe("выбор изображения внутри публикации", () => {
  const images = [
    { id: "cover", src: "/cover.webp", thumbnail: "/cover-small.webp", alt: "Обложка", width: 800, height: 1000 },
    { id: "page-1", src: "/page-1.webp", thumbnail: "/page-1-small.webp", alt: "Страница 1", width: 800, height: 1000 },
    { id: "page-2", src: "/page-2.webp", thumbnail: "/page-2-small.webp", alt: "Страница 2", width: 800, height: 1000 },
  ];

  it("оставляет обложке небольшой шанс, но обычно выбирает внутреннюю работу", () => {
    expect(pickWanderImage(images, [], () => .04)?.id).toBe("cover");
    expect(pickWanderImage(images, [], () => .05)?.id).toBe("page-1");
    expect(pickWanderImage(images, [], () => .99)?.id).toBe("page-2");
  });

  it("исключает недавно показанные изображения, пока есть свежие", () => {
    expect(pickWanderImage(images, ["page-1"], () => .1)?.id).toBe("page-2");
    expect(pickWanderImage(images, ["cover", "page-1"], () => 0)?.id).toBe("page-2");
  });

  it("при наличии выбора меняет вертикальный формат на горизонтальный", () => {
    expect(pickWanderImage(images, [], () => .99, images[1])?.id).toBe("page-2");
    const mixed = [
      images[1],
      { id: "landscape", src: "/landscape.webp", thumbnail: "/landscape-small.webp", alt: "Горизонтальная работа", width: 1200, height: 800 },
    ];
    expect(pickWanderImage(mixed, [], () => 0, images[1])?.id).toBe("landscape");
  });

  it("хранит ограниченную очередь и очищает её от отсутствующих изображений", () => {
    expect(rememberWanderImage(["page-1", "cover"], "cover")).toEqual(["cover", "page-1"]);
    const catalogue = wanderFixture();
    expect(restoreWanderRecentImages('["a-1","missing","a-1","b-1"]', catalogue)).toEqual(["a-1", "b-1"]);
  });
});

describe("маршрут в пределах вкладки", () => {
  const journey = {
    steps: [{ postId: "a", projectId: "portrait", imageId: "a-1" }, { postId: "b", projectId: "portrait", imageId: "b-1" }],
    viewedPostIds: ["a", "b"],
    cursor: 0,
    exhibitionSeenAt: 0,
  };
  it("восстанавливает последовательность и выбранную работу", () => {
    expect(restoreWanderJourney(serializeWanderJourney(journey), wanderFixture())).toEqual(journey);
  });
  it("восстанавливает реплику только из разрешённого набора", () => {
    const saved = { ...journey, steps: journey.steps.map((step) => ({ ...step, nextLabel: "шмыг" as const })) };
    expect(restoreWanderJourney(serializeWanderJourney(saved), wanderFixture())).toEqual(saved);
    const invalid = JSON.stringify({ version: 4, ...journey, steps: journey.steps.map((step) => ({ ...step, nextLabel: "купить" })) });
    expect(restoreWanderJourney(invalid, wanderFixture())).toEqual(journey);
  });
  it.each([null, "broken", "null", "{}", '{"version":2,"steps":[]}', "x".repeat(200_001)])("отбрасывает повреждённые данные", (raw) => {
    expect(restoreWanderJourney(raw, wanderFixture())).toBeNull();
  });
  it("убирает удалённые/скрытые работы и дубликаты", () => {
    const saved = { steps: [null, { postId: "draft", projectId: "portrait" }, ...journey.steps, journey.steps[0]], cursor: 3 };
    expect(restoreWanderJourney(JSON.stringify({ version: 1, ...saved }), wanderFixture())).toEqual({ ...journey, cursor: 1 });
  });
  it("при снятии одной подборки с публикации использует другую публичную связь", () => {
    const catalogue = wanderFixture();
    catalogue.projects = catalogue.projects.filter((project) => project.id !== "portrait");
    catalogue.posts = catalogue.posts.filter((post) => post.id !== "a").map((post) => ({ ...post, projectIds: post.projectIds.filter((id) => id !== "portrait") }));
    expect(restoreWanderJourney(serializeWanderJourney(journey), catalogue)).toEqual({
      steps: [{ postId: "b", projectId: "pen", imageId: "b-1" }],
      viewedPostIds: ["b"],
      cursor: 0,
      exhibitionSeenAt: 0,
    });
  });
  it("читает старый маршрут как уже просмотренный", () => {
    const legacySteps = journey.steps.map(({ postId, projectId }) => ({ postId, projectId }));
    const legacy = JSON.stringify({ version: 1, steps: legacySteps, cursor: 1 });
    const restored = restoreWanderJourney(legacy, wanderFixture());
    expect(restored?.viewedPostIds).toEqual(["a", "b"]);
    expect(restored?.steps.map((step) => step.imageId)).toEqual(["a-1", "b-1"]);
  });
  it("оставляет непоказанную работу вне выставки", () => {
    const saved = serializeWanderJourney({ ...journey, viewedPostIds: ["a"] });
    expect(restoreWanderJourney(saved, wanderFixture())?.viewedPostIds).toEqual(["a"]);
  });
  it("сохраняет опубликованную работу, даже если она больше не состоит в подборке", () => {
    const catalogue = wanderFixture();
    catalogue.posts = catalogue.posts.map((post) => post.id === "a" ? { ...post, projectIds: [] } : post);
    catalogue.projects = catalogue.projects.filter((project) => project.id !== "portrait");
    const restored = restoreWanderJourney(serializeWanderJourney({
      steps: [{ postId: "a", projectId: "portrait", imageId: "a-1" }],
      viewedPostIds: ["a"], cursor: 0, exhibitionSeenAt: 0,
    }), catalogue);
    expect(restored?.steps).toEqual([{ postId: "a", imageId: "a-1" }]);
  });
});

describe("название выставки", () => {
  it("собирается только из действительно показанных работ", () => {
    const catalogue = wanderFixture();
    const journey = {
      steps: [
        { postId: "a", projectId: "portrait" },
        { postId: "c", projectId: "pen" },
        { postId: "d", projectId: "wolf" },
      ],
      viewedPostIds: ["a", "d"], cursor: 2, exhibitionSeenAt: 0,
    };
    expect(wanderExhibitionTitle(journey, catalogue)).toBe("«портрет» и «волк-дурень» вышли погулять");
    expect(wanderExhibitionTags(journey, catalogue)).toEqual(["портрет", "волк-дурень"]);
    expect(wanderExhibitionNumber(journey)).toMatch(/^\d{5}$/);
    expect(wanderExhibitionNumber(journey)).toBe(wanderExhibitionNumber({ ...journey }));
  });
});
