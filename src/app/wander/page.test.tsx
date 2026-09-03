import { describe, expect, it, vi } from "vitest";
import { wanderFixture } from "@/test/wander-fixture";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), catalogue: vi.fn() }));
vi.mock("@/lib/site", () => ({ getSiteSettings: mocks.settings }));
vi.mock("@/lib/wander-data", () => ({ getWanderCatalogue: mocks.catalogue }));
vi.mock("@/components/wander/WanderExperience", () => ({ WanderExperience: () => null }));

describe("страница прогулки", () => {
  it("передаёт сохранённое количество изображений в режим", async () => {
    const catalogue = wanderFixture();
    mocks.catalogue.mockResolvedValue(catalogue);
    mocks.settings.mockResolvedValue({ wanderImageCount: 12 });
    const { default: WanderPage } = await import("./page");
    const page = await WanderPage();
    expect(page.props.imageCount).toBe(12);
    expect(page.props.catalogue).toBe(catalogue);
    expect(page.props.initialStep).not.toBeNull();
  });
});
