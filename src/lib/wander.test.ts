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
  it("находит работу-мост внутри текущей подборки", () => {
    const start = { postId: "a", projectId: "portrait" };
    expect(nextWanderStep(wanderFixture(), [start], start, () => 0)).toEqual({ postId: "b", projectId: "portrait", imageId: "b-1" });
  });
  it("через мост уходит в другую подборку вместо повтора той же", () => {
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
  it("без явной связи не остаётся в одной серии дольше двух работ", () => {
    const fixture = wanderFixture();
    const first = { postId: "a", projectId: "portrait" };
    const second = { postId: "b", projectId: "portrait" };
    const next = nextWanderStep(fixture, [first, second], second, () => .99);
    expect(next?.projectId).not.toBe("portrait");
  });
  it("после ухода по возможности возвращает первый мотив", () => {
    const fixture = wanderFixture();
    fixture.posts.push({
      id: "e", slug: "second-portrait", title: "Другой портрет",
      images: [{ id: "e-1", src: "/e.webp", thumbnail: "/e-small.webp", alt: "Другой портрет", width: 800, height: 1000 }],
      projectIds: ["portrait"],
    });
    fixture.projects[0].postIds.push("e");
    const visited = [
      { postId: "a", projectId: "portrait" },
      { postId: "b", projectId: "portrait" },
      { postId: "c", projectId: "pen" },
      { postId: "d", projectId: "wolf" },
    ];
    expect(nextWanderStep(fixture, visited, visited.at(-1), () => .99)?.projectId).toBe("portrait");
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
