import { describe, expect, it } from "vitest";
import { nextWanderStep, restoreWanderJourney, serializeWanderJourney, wanderExhibitionTitle, type WanderStep } from "./wander";
import { wanderFixture } from "@/test/wander-fixture";

describe("прогулка по подборкам", () => {
  it("первым выбирает подборку, а не взвешивает её по количеству работ", () => {
    expect(nextWanderStep(wanderFixture(), [], undefined, () => .99)).toEqual({ postId: "d", projectId: "wolf" });
  });
  it("находит работу-мост внутри текущей подборки", () => {
    const start = { postId: "a", projectId: "portrait" };
    expect(nextWanderStep(wanderFixture(), [start], start, () => 0)).toEqual({ postId: "b", projectId: "portrait" });
  });
  it("через мост уходит в другую подборку вместо повтора той же", () => {
    const bridge = { postId: "b", projectId: "portrait" };
    expect(nextWanderStep(wanderFixture(), [bridge], bridge, () => 0)).toEqual({ postId: "c", projectId: "pen" });
  });
  it("в тупике выбирает другую непосмотренную работу", () => {
    const visited = [{ postId: "b", projectId: "portrait" }, { postId: "c", projectId: "pen" }];
    expect(nextWanderStep(wanderFixture(), visited, visited[1], () => .99)).toEqual({ postId: "d", projectId: "wolf" });
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
      image: { src: "/e.webp", thumbnail: "/e-small.webp", alt: "Другой портрет", width: 800, height: 1000 },
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

describe("маршрут в пределах вкладки", () => {
  const journey = {
    steps: [{ postId: "a", projectId: "portrait" }, { postId: "b", projectId: "portrait" }],
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
      steps: [{ postId: "b", projectId: "pen" }],
      viewedPostIds: ["b"],
      cursor: 0,
      exhibitionSeenAt: 0,
    });
  });
  it("читает старый маршрут как уже просмотренный", () => {
    const legacy = JSON.stringify({ version: 1, steps: journey.steps, cursor: 1 });
    expect(restoreWanderJourney(legacy, wanderFixture())?.viewedPostIds).toEqual(["a", "b"]);
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
    expect(wanderExhibitionTitle(journey, catalogue)).toBe("портрет / волк-дурень");
  });
});
