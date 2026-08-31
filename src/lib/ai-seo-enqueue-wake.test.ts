// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  wake: vi.fn(),
  db: {
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    project: { findMany: vi.fn() }, siteSettings: { findUnique: vi.fn() },
    aiSeoJob: { upsert: vi.fn() }, aiSeoReview: { upsert: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/ai-seo-worker", () => ({ wakeAiSeoWorker: mocks.wake, getAiSeoWorkerStatus: vi.fn() }));
vi.mock("@/lib/ai-seo", () => ({
  generateImageAlt: vi.fn(), generatePostIdentity: vi.fn(), generatePostSeo: vi.fn(), generateProjectSeo: vi.fn(),
}));
import { enqueuePublishedPostAiSeo } from "./ai-seo-jobs";
import { enqueueAiSeoReviews } from "./ai-seo-reviews";
import { POST_STATUS } from "./constants";

beforeEach(() => {
  mocks.db.aiSeoJob.upsert.mockResolvedValue({ id: "job" });
  mocks.db.aiSeoReview.upsert.mockResolvedValue({ id: "review" });
  mocks.db.aiSeoReview.findMany.mockResolvedValue([]);
  mocks.db.post.findMany.mockResolvedValue([]);
  mocks.db.project.findMany.mockResolvedValue([]);
  mocks.db.siteSettings.findUnique.mockResolvedValue(null);
});

describe("запуск по появлению задачи", () => {
  it("публикация/импорт: каждая сохранённая задача SEO/alt будит worker", async () => {
    mocks.db.post.findUnique.mockResolvedValue({
      status: POST_STATUS.PUBLISHED, metaTitleSource: "AUTO", metaDescriptionSource: "AUTO",
      images: [{ id: "i1", alt: "", altSource: "AUTO" }, { id: "i2", alt: "Авторский alt", altSource: "MANUAL" }],
    });
    await enqueuePublishedPostAiSeo("post");
    expect(mocks.db.aiSeoJob.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.wake).toHaveBeenCalledTimes(2);
    expect(mocks.wake.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.db.aiSeoJob.upsert.mock.invocationCallOrder[0]);
  });

  it("черновик и полностью ручные поля не будят worker", async () => {
    mocks.db.post.findUnique.mockResolvedValueOnce({ status: POST_STATUS.DRAFT })
      .mockResolvedValueOnce({ status: POST_STATUS.PUBLISHED, metaTitleSource: "MANUAL", metaDescriptionSource: "MANUAL", images: [] });
    await enqueuePublishedPostAiSeo("draft");
    await enqueuePublishedPostAiSeo("manual");
    expect(mocks.wake).not.toHaveBeenCalled();
  });

  it("частичная ошибка пачки не теряет сигнал для уже сохранённой задачи", async () => {
    mocks.db.post.findUnique.mockResolvedValue({
      status: POST_STATUS.PUBLISHED, metaTitleSource: "AUTO", metaDescriptionSource: "AUTO",
      images: [{ id: "i1", alt: "", altSource: "AUTO" }],
    });
    mocks.db.aiSeoJob.upsert.mockResolvedValueOnce({ id: "seo" }).mockRejectedValueOnce(new Error("db"));
    await expect(enqueuePublishedPostAiSeo("post")).rejects.toThrow("db");
    expect(mocks.wake).toHaveBeenCalledTimes(1);
  });

  it("предложения SEO для публикаций и проектов также будят worker", async () => {
    mocks.db.post.findMany.mockResolvedValue([{
      id: "p", slug: "post", title: "Публикация", body: "", metaTitle: "", metaDescription: "",
      category: null, projects: [], images: [],
    }]);
    mocks.db.project.findMany.mockResolvedValue([{
      id: "r", slug: "project", title: "Проект", description: "", metaTitle: "", metaDescription: "",
      status: POST_STATUS.PUBLISHED, posts: [],
    }]);
    const result = await enqueueAiSeoReviews("CRITICAL");
    expect(result.queued).toBe(2);
    expect(mocks.wake).toHaveBeenCalledTimes(2);
  });

  it("без новых предложений worker не будит", async () => {
    expect((await enqueueAiSeoReviews("CRITICAL")).queued).toBe(0);
    expect(mocks.wake).not.toHaveBeenCalled();
  });
});
